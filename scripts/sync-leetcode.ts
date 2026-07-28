/**
 * Daily LeetCode synchronisation.
 *
 * This runs inside GitHub Actions against the database directly, rather than
 * through the HTTP API — a full college of 2,000 profiles takes several minutes
 * and would blow through the 60-second serverless function limit on Vercel's
 * free tier. Actions gives us hours, and costs nothing on a public repo.
 *
 *   npm run sync                 # sync everyone
 *   npm run sync -- --limit 50   # sync the 50 stalest profiles
 *   npm run sync -- --dry-run    # fetch and report without writing
 */
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

import { runSync } from "../lib/sync";
import { fetchLeetCodeStats } from "../lib/leetcode";
import { mapWithConcurrency } from "../lib/utils";

config();

const prisma = new PrismaClient();

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function dryRun(limit?: number) {
  const users = await prisma.user.findMany({
    select: { name: true, registerNo: true, leetcodeUsername: true },
    orderBy: { createdAt: "asc" },
    ...(limit ? { take: limit } : {}),
  });

  console.log(`Dry run over ${users.length} profile(s) — nothing will be written.\n`);

  let ok = 0;
  let failed = 0;

  await mapWithConcurrency(users, 4, async (user) => {
    const result = await fetchLeetCodeStats(user.leetcodeUsername);
    if (result.ok) {
      ok++;
      console.log(
        `  ✓ ${user.leetcodeUsername.padEnd(24)} ${String(result.stats.totalSolved).padStart(5)} solved · streak ${result.stats.currentStreak}`,
      );
    } else {
      failed++;
      console.log(`  ✗ ${user.leetcodeUsername.padEnd(24)} ${result.error}`);
    }
  });

  console.log(`\n${ok} reachable, ${failed} failed.`);
}

async function main() {
  const started = Date.now();
  const limitRaw = readFlag("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  if (limit !== undefined && (!Number.isFinite(limit) || limit < 1)) {
    throw new Error("--limit must be a positive number.");
  }

  console.log("LeetTrack AI — daily synchronisation");
  console.log(`Started ${new Date().toISOString()}`);

  if (hasFlag("dry-run")) {
    await dryRun(limit);
    return;
  }

  const total = await prisma.user.count();
  if (total === 0) {
    console.log("\nNo users are being tracked yet — nothing to do.");
    return;
  }

  console.log(`Tracking ${total} user(s).${limit ? ` Limiting to ${limit}.` : ""}\n`);

  let lastReported = 0;
  const summary = await runSync({
    triggeredBy: "cron",
    limit,
    onProgress: (done, count) => {
      // One line per 10% keeps the Actions log readable.
      const step = Math.max(1, Math.floor(count / 10));
      if (done - lastReported >= step || done === count) {
        lastReported = done;
        console.log(
          `  ${String(done).padStart(5)} / ${count}  (${((done / count) * 100).toFixed(0)}%)`,
        );
      }
    },
  });

  console.log("\n─────────────────────────────────────────");
  console.log(`Status        ${summary.status}`);
  console.log(`Processed     ${summary.total}`);
  console.log(`Succeeded     ${summary.succeeded}`);
  console.log(`Failed        ${summary.failed}`);
  console.log(`Invalid       ${summary.invalidProfiles}`);
  console.log(`Remaining     ${summary.remaining}`);
  console.log(`Duration      ${(summary.durationMs / 1000).toFixed(1)}s`);
  console.log("─────────────────────────────────────────");

  if (summary.errors.length > 0) {
    console.log(`\nFirst ${Math.min(20, summary.errors.length)} problem(s):`);
    for (const error of summary.errors.slice(0, 20)) {
      console.log(`  ✗ ${error.username.padEnd(24)} ${error.name} — ${error.error}`);
    }
  }

  console.log(`\nTotal wall time ${((Date.now() - started) / 1000).toFixed(1)}s`);

  // A run where nothing succeeded means LeetCode is unreachable or blocking —
  // fail the workflow so the failure is visible instead of silent.
  if (summary.status === "FAILED") {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("\n✗ Sync failed:", error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
