import type { NextRequest } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";

import { auth } from "@/auth";
import { badRequest, handleError, ok, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { runSync } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Vercel Hobby caps a serverless function at 60 s. */
export const maxDuration = 60;

/** Batch size that comfortably finishes inside the function time budget. */
const DEFAULT_BATCH = 90;

const bodySchema = z.object({
  userIds: z.array(z.string()).max(500).optional(),
  limit: z.number().int().min(1).max(500).optional(),
  /** ISO timestamp cursor — the moment the admin clicked "Sync now". */
  startedBefore: z.string().datetime().optional(),
});

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * This route is excluded from the auth middleware so GitHub Actions can reach
 * it, which means it must authorise every request itself: either a signed-in
 * admin session, or the shared CRON_SECRET as a bearer token.
 */
async function authorize(request: NextRequest): Promise<boolean> {
  const header = request.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;

  if (secret && header.startsWith("Bearer ")) {
    if (constantTimeEquals(header.slice(7).trim(), secret)) return true;
  }

  const session = await auth();
  return Boolean(session?.user);
}

export async function POST(request: NextRequest) {
  try {
    if (!(await authorize(request))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      /* An empty body is a valid "sync the next batch" request. */
    }

    const parsed = bodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      return badRequest("Validation failed", parsed.error.flatten());
    }

    const { userIds, limit, startedBefore } = parsed.data;

    const summary = await runSync({
      triggeredBy: "manual",
      userIds,
      limit: userIds?.length ? undefined : (limit ?? DEFAULT_BATCH),
      startedBefore: startedBefore ? new Date(startedBefore) : undefined,
    });

    return ok(summary);
  } catch (error) {
    return handleError(error);
  }
}

/** Sync history + how much of today's run is still outstanding. */
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const [history, pending, totalUsers] = await Promise.all([
      prisma.syncLog.findMany({ orderBy: { startedAt: "desc" }, take: 15 }),
      prisma.user.count({
        where: {
          status: { not: "INVALID_PROFILE" },
          OR: [
            { lastSyncedAt: null },
            {
              lastSyncedAt: {
                lt: new Date(new Date().toISOString().slice(0, 10)),
              },
            },
          ],
        },
      }),
      prisma.user.count(),
    ]);

    const last = history[0] ?? null;

    return ok({
      running: last?.status === "RUNNING",
      pending,
      totalUsers,
      last: last
        ? {
            id: last.id,
            startedAt: last.startedAt.toISOString(),
            finishedAt: last.finishedAt?.toISOString() ?? null,
            status: last.status,
            totalUsers: last.totalUsers,
            succeeded: last.succeeded,
            failed: last.failed,
            durationMs: last.durationMs,
            triggeredBy: last.triggeredBy,
            message: last.message,
          }
        : null,
      history: history.map((row) => ({
        id: row.id,
        startedAt: row.startedAt.toISOString(),
        status: row.status,
        succeeded: row.succeeded,
        failed: row.failed,
        durationMs: row.durationMs,
        triggeredBy: row.triggeredBy,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}
