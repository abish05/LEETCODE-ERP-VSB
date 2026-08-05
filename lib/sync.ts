import { Prisma, type Role } from "@prisma/client";

import { prisma } from "./prisma";
import {
  DEFAULT_BATCH_SIZE,
  fetchLeetCodeStatsBatch,
  type LeetCodeStats,
} from "./leetcode";
import { mapWithConcurrency, sleep, utcMidnight } from "./utils";
import { INACTIVE_THRESHOLD_DAYS, SETTING_KEYS } from "./constants";

export interface SyncOptions {
  triggeredBy?: "cron" | "manual" | "import";
  /** Restrict the run to specific users (used by "refresh this profile"). */
  userIds?: string[];
  /**
   * Cap the batch to the N stalest profiles. Serverless functions cap out at
   * 60 s, so the UI syncs in bounded batches and repeats until `remaining` is
   * zero; the GitHub Actions job leaves this unset and does the lot in one go.
   */
  limit?: number;
  concurrency?: number;
  delayMs?: number;
  maxRetries?: number;
  /** Profiles per GraphQL request. See DEFAULT_BATCH_SIZE; 1 disables batching. */
  batchSize?: number;
  /**
   * Also re-check INVALID_PROFILE users whose last attempt is older than this
   * many days. Without it a single transient "user does not exist" would drop
   * a student from tracking permanently.
   */
  recheckInvalidAfterDays?: number;
  onProgress?: (done: number, total: number) => void;
}

export interface SyncSummary {
  syncLogId: string;
  total: number;
  succeeded: number;
  failed: number;
  invalidProfiles: number;
  /** Profiles still awaiting today's sync after this batch. */
  remaining: number;
  durationMs: number;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  errors: Array<{ username: string; name: string; error: string }>;
}

/**
 * Trackable users not yet *attempted* today.
 *
 * Deliberately keyed on `lastAttemptAt`, not `lastSyncedAt`: this number drives
 * the client's "keep going until zero" loop, so it has to fall monotonically
 * even when a profile fails every single time.
 */
async function countPending(): Promise<number> {
  return prisma.user.count({
    where: {
      status: { not: "INVALID_PROFILE" },
      OR: [{ lastAttemptAt: null }, { lastAttemptAt: { lt: utcMidnight() } }],
    },
  });
}

/**
 * A serverless function that is killed mid-run (Vercel caps at 60 s) leaves its
 * SyncLog stuck on RUNNING, which makes the UI report a sync in flight forever.
 * Anything still RUNNING after this long is certainly dead.
 */
const STALE_RUN_MS = 15 * 60_000;

async function closeStaleRuns(): Promise<number> {
  const { count } = await prisma.syncLog.updateMany({
    where: {
      status: "RUNNING",
      startedAt: { lt: new Date(Date.now() - STALE_RUN_MS) },
    },
    data: {
      status: "FAILED",
      finishedAt: new Date(),
      message: "Run did not finish — most likely the function timed out.",
    },
  });
  return count;
}

type TrackedUser = {
  id: string;
  name: string;
  registerNo: string;
  department: string;
  role: Role;
  leetcodeUsername: string;
  totalSolved: number;
  currentStreak: number;
};

/**
 * Yesterday's (or the most recent prior) cumulative total for every user, in a
 * single indexed query. `DISTINCT ON` is Postgres-native and far cheaper than
 * pulling every snapshot and de-duplicating in JS — which matters at 2,000
 * users × 365 days.
 */
async function loadBaselineTotals(
  today: Date,
  userIds?: string[],
): Promise<Map<string, number>> {
  const rows = userIds?.length
    ? await prisma.$queryRaw<Array<{ userId: string; totalSolved: number }>>`
        SELECT DISTINCT ON ("userId") "userId", "totalSolved"
        FROM "daily_snapshots"
        WHERE "date" < ${today} AND "userId" IN (${Prisma.join(userIds)})
        ORDER BY "userId", "date" DESC
      `
    : await prisma.$queryRaw<Array<{ userId: string; totalSolved: number }>>`
        SELECT DISTINCT ON ("userId") "userId", "totalSolved"
        FROM "daily_snapshots"
        WHERE "date" < ${today}
        ORDER BY "userId", "date" DESC
      `;

  return new Map(rows.map((row) => [row.userId, Number(row.totalSolved)]));
}

/**
 * Runs a full synchronisation pass.
 *
 * Network fetches run with bounded concurrency (LeetCode throttles aggressively
 * and we are a guest on their endpoint); database writes are then applied in
 * batched transactions so we never hold 2,000 open statements against a
 * free-tier connection pool.
 */
export async function runSync(options: SyncOptions = {}): Promise<SyncSummary> {
  const {
    triggeredBy = "manual",
    userIds,
    limit,
    concurrency = Number(process.env.SYNC_CONCURRENCY ?? 3),
    delayMs = Number(process.env.SYNC_DELAY_MS ?? 0),
    maxRetries = Number(process.env.SYNC_MAX_RETRIES ?? 3),
    batchSize = Number(process.env.SYNC_BATCH_SIZE ?? DEFAULT_BATCH_SIZE),
    recheckInvalidAfterDays = Number(process.env.SYNC_RECHECK_INVALID_DAYS ?? 7),
    onProgress,
  } = options;

  const startedAt = Date.now();
  const today = utcMidnight();

  await closeStaleRuns();

  // Build the WHERE clause based on the trigger:
  //  - explicit userIds → exactly those users (single-profile refresh)
  //  - cron → only users not yet synced today (avoid re-doing work)
  //  - manual (dashboard "Sync now") → all users except INVALID_PROFILE
  // Invalid handles are skipped by default, but re-tried occasionally so a
  // one-off false "does not exist" cannot drop a student forever.
  const recheckCutoff = new Date(
    Date.now() - Math.max(1, recheckInvalidAfterDays) * 86_400_000,
  );
  const trackable: Prisma.UserWhereInput = {
    OR: [
      { status: { not: "INVALID_PROFILE" } },
      {
        status: "INVALID_PROFILE",
        OR: [
          { lastAttemptAt: null },
          { lastAttemptAt: { lt: recheckCutoff } },
        ],
      },
    ],
  };

  const whereClause: Prisma.UserWhereInput = userIds?.length
    ? { id: { in: userIds } }
    : triggeredBy === "cron"
      ? {
          AND: [
            trackable,
            {
              OR: [
                { lastAttemptAt: null },
                { lastAttemptAt: { lt: today } },
              ],
            },
          ],
        }
      : trackable;

  const users = (await prisma.user.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      registerNo: true,
      department: true,
      role: true,
      leetcodeUsername: true,
      totalSolved: true,
      currentStreak: true,
    },
    // Stalest first, so a repeated batch run always makes forward progress.
    orderBy: userIds?.length
      ? { createdAt: "asc" }
      : [{ lastAttemptAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    ...(limit && !userIds?.length ? { take: limit } : {}),
  })) as TrackedUser[];

  const syncLog = await prisma.syncLog.create({
    data: { status: "RUNNING", totalUsers: users.length, triggeredBy },
  });

  if (users.length === 0) {
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt,
        message: "No users to sync.",
      },
    });
    return {
      syncLogId: syncLog.id,
      total: 0,
      succeeded: 0,
      failed: 0,
      invalidProfiles: 0,
      remaining: 0,
      durationMs: Date.now() - startedAt,
      status: "SUCCESS",
      errors: [],
    };
  }

  const baseline = await loadBaselineTotals(today, userIds);

  let completed = 0;
  const errors: SyncSummary["errors"] = [];
  const notifications: Prisma.NotificationCreateManyInput[] = [];

  type Outcome =
    | { kind: "ok"; user: TrackedUser; stats: LeetCodeStats; todaySolved: number }
    | { kind: "missing"; user: TrackedUser; error: string }
    | { kind: "error"; user: TrackedUser; error: string };

  // One GraphQL request per batch rather than per student — see
  // fetchLeetCodeStatsBatch. This is what makes a full college sync finish in
  // seconds instead of minutes, and cuts requests to LeetCode ~20-fold.
  const size = Math.max(1, batchSize);
  const batches: TrackedUser[][] = [];
  for (let i = 0; i < users.length; i += size) {
    batches.push(users.slice(i, i + size));
  }

  const batched = await mapWithConcurrency<TrackedUser[], Outcome[]>(
    batches,
    Math.max(1, concurrency),
    async (batch, index) => {
      if (delayMs > 0 && index >= concurrency) await sleep(delayMs);

      const found = await fetchLeetCodeStatsBatch(
        batch.map((user) => user.leetcodeUsername),
        { maxRetries },
      );

      completed += batch.length;
      onProgress?.(Math.min(completed, users.length), users.length);

      return batch.map((user): Outcome => {
        const result = found.get(user.leetcodeUsername);

        // Defensive: a missing entry means the alias never came back. Treat it
        // as transient so the profile keeps its last good numbers.
        if (!result) {
          return { kind: "error", user, error: "No response for this profile" };
        }
        if (!result.ok) {
          return result.notFound
            ? { kind: "missing", user, error: result.error }
            : { kind: "error", user, error: result.error };
        }

        const previousTotal = baseline.get(user.id) ?? result.stats.totalSolved;
        // Guard against LeetCode briefly under-reporting after a rejudge.
        const todaySolved = Math.max(
          0,
          result.stats.totalSolved - previousTotal,
        );
        return { kind: "ok", user, stats: result.stats, todaySolved };
      });
    },
  );

  const outcomes = batched.flat();

  // ── Apply writes in batches ────────────────────────────────────────────
  const CHUNK = 50;
  let succeeded = 0;
  let invalidProfiles = 0;

  for (let i = 0; i < outcomes.length; i += CHUNK) {
    const chunk = outcomes.slice(i, i + CHUNK);
    const operations: Prisma.PrismaPromise<unknown>[] = [];

    for (const outcome of chunk) {
      if (outcome.kind === "ok") {
        const { user, stats, todaySolved } = outcome;
        succeeded++;

        const snapshotData = {
          totalSolved: stats.totalSolved,
          easySolved: stats.easySolved,
          mediumSolved: stats.mediumSolved,
          hardSolved: stats.hardSolved,
          todaySolved,
          currentStreak: stats.currentStreak,
          maxStreak: stats.maxStreak,
          ranking: stats.ranking,
          contestRating: stats.contestRating,
          totalActiveDays: stats.totalActiveDays,
          acceptanceRate: stats.acceptanceRate,
          lastSyncedAt: new Date(),
        };

        operations.push(
          prisma.dailySnapshot.upsert({
            where: { userId_date: { userId: user.id, date: today } },
            create: { userId: user.id, date: today, ...snapshotData },
            update: snapshotData,
          }),
        );

        operations.push(
          prisma.user.update({
            where: { id: user.id },
            data: {
              ...snapshotData,
              lastSyncedAt: new Date(),
              lastAttemptAt: new Date(),
              avatarUrl: stats.avatarUrl,
              contestsCount: stats.contestsCount,
              status: "ACTIVE",
              syncError: null,
              // LeetCode reports the canonical casing of the handle.
              leetcodeUsername: stats.username,
            },
          }),
        );

        if (
          stats.username.toLowerCase() !==
          user.leetcodeUsername.toLowerCase()
        ) {
          notifications.push({
            type: "USERNAME_CHANGED",
            title: "LeetCode username changed",
            message: `${user.name} (${user.registerNo}) now resolves to "${stats.username}" instead of "${user.leetcodeUsername}".`,
            userId: user.id,
          });
        }
      } else if (outcome.kind === "missing") {
        invalidProfiles++;
        errors.push({
          username: outcome.user.leetcodeUsername,
          name: outcome.user.name,
          error: outcome.error,
        });
        operations.push(
          prisma.user.update({
            where: { id: outcome.user.id },
            data: {
              status: "INVALID_PROFILE",
              syncError: outcome.error,
              // Not lastSyncedAt — nothing was actually read.
              lastAttemptAt: new Date(),
            },
          }),
        );
        notifications.push({
          type: "INVALID_PROFILE",
          title: "Invalid LeetCode profile",
          message: `${outcome.user.name} (${outcome.user.registerNo}) — "${outcome.user.leetcodeUsername}" could not be found on LeetCode.`,
          userId: outcome.user.id,
        });
      } else {
        errors.push({
          username: outcome.user.leetcodeUsername,
          name: outcome.user.name,
          error: outcome.error,
        });
        // A transient failure must not wipe the last good numbers, and must not
        // pretend the profile was synced. Stamping lastAttemptAt (not
        // lastSyncedAt) still guarantees the batch queue moves forward.
        operations.push(
          prisma.user.update({
            where: { id: outcome.user.id },
            data: {
              syncError: outcome.error,
              lastAttemptAt: new Date(),
            },
          }),
        );
      }
    }

    await prisma.$transaction(operations);
  }

  await generateNotifications(today, notifications);

  const durationMs = Date.now() - startedAt;
  const failed = users.length - succeeded;
  const status: SyncSummary["status"] =
    succeeded === 0 && users.length > 0
      ? "FAILED"
      : failed > 0
        ? "PARTIAL"
        : "SUCCESS";

  await prisma.syncLog.update({
    where: { id: syncLog.id },
    data: {
      status,
      finishedAt: new Date(),
      durationMs,
      succeeded,
      failed,
      message:
        failed > 0
          ? `${failed} of ${users.length} profiles could not be synced (${invalidProfiles} invalid).`
          : `All ${succeeded} profiles synced successfully.`,
    },
  });

  await prisma.setting.upsert({
    where: { key: SETTING_KEYS.LAST_SYNC_AT },
    create: {
      key: SETTING_KEYS.LAST_SYNC_AT,
      value: new Date().toISOString(),
    },
    update: { value: new Date().toISOString() },
  });

  return {
    syncLogId: syncLog.id,
    total: users.length,
    succeeded,
    failed,
    invalidProfiles,
    remaining: await countPending(),
    durationMs,
    status,
    errors: errors.slice(0, 100),
  };
}

/**
 * Derives the "what changed today" feed. Runs after every sync so the
 * notification bell is always in step with the latest snapshot.
 */
async function generateNotifications(
  today: Date,
  pending: Prisma.NotificationCreateManyInput[],
) {
  const inactiveDaysSetting = await prisma.setting.findUnique({
    where: { key: SETTING_KEYS.INACTIVE_DAYS },
  });
  const inactiveDays =
    Number(inactiveDaysSetting?.value) || INACTIVE_THRESHOLD_DAYS;

  const [topSolver, topStreak, inactiveCount] = await Promise.all([
    prisma.user.findFirst({
      where: { todaySolved: { gt: 0 } },
      orderBy: { todaySolved: "desc" },
      select: { id: true, name: true, registerNo: true, todaySolved: true },
    }),
    prisma.user.findFirst({
      where: { currentStreak: { gt: 0 } },
      orderBy: { currentStreak: "desc" },
      select: { id: true, name: true, registerNo: true, currentStreak: true },
    }),
    prisma.dailySnapshot
      .groupBy({
        by: ["userId"],
        where: {
          date: {
            gte: new Date(today.getTime() - inactiveDays * 86_400_000),
          },
        },
        _sum: { todaySolved: true },
      })
      .then((rows) => rows.filter((r) => (r._sum.todaySolved ?? 0) === 0).length),
  ]);

  if (topSolver) {
    pending.push({
      type: "TOP_DAILY_SOLVER",
      title: "Top solver today",
      message: `${topSolver.name} (${topSolver.registerNo}) solved ${topSolver.todaySolved} problem${topSolver.todaySolved === 1 ? "" : "s"} today.`,
      userId: topSolver.id,
    });
  }

  if (topStreak) {
    pending.push({
      type: "HIGHEST_STREAK",
      title: "Highest active streak",
      message: `${topStreak.name} (${topStreak.registerNo}) is on a ${topStreak.currentStreak}-day streak.`,
      userId: topStreak.id,
    });
  }

  if (inactiveCount > 0) {
    pending.push({
      type: "INACTIVE_USER",
      title: `${inactiveCount} inactive user${inactiveCount === 1 ? "" : "s"}`,
      message: `${inactiveCount} tracked user${inactiveCount === 1 ? " has" : "s have"} not solved a problem in the last ${inactiveDays} days.`,
    });
  }

  if (pending.length > 0) {
    await prisma.notification.createMany({ data: pending });
  }

  // Keep the feed bounded — the bell is a signal, not an archive.
  const cutoff = new Date(Date.now() - 30 * 86_400_000);
  await prisma.notification.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
}
