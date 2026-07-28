import type { NextRequest } from "next/server";

import { handleError, ok, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { buildUserWhere, USER_SELECT } from "@/lib/queries";
import { SPLIT_BUCKETS, ZERO_BUCKET } from "@/lib/constants";

export const dynamic = "force-dynamic";

const ALL_BUCKETS = [ZERO_BUCKET, ...SPLIT_BUCKETS];

/**
 * Split Report — how many tracked users fall into each problems-solved band.
 *
 * Counts for every band come back in one round-trip; the member list is only
 * fetched when the admin drills into a specific bucket.
 */
export async function GET(request: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const { searchParams } = new URL(request.url);
    const baseWhere = buildUserWhere(searchParams);
    const bucketId = searchParams.get("bucket");

    const counts = await Promise.all(
      ALL_BUCKETS.map((bucket) =>
        prisma.user.count({
          where: {
            ...baseWhere,
            totalSolved: {
              gte: bucket.min,
              ...(bucket.max !== null ? { lte: bucket.max } : {}),
            },
          },
        }),
      ),
    );

    const total = counts.reduce((sum, count) => sum + count, 0);

    const buckets = ALL_BUCKETS.map((bucket, index) => ({
      id: bucket.id,
      label: bucket.label,
      min: bucket.min,
      max: bucket.max,
      count: counts[index],
      percentage: total === 0 ? 0 : (counts[index] / total) * 100,
    }));

    // ── Drill-down ───────────────────────────────────────────────────
    let members: unknown[] = [];
    if (bucketId) {
      const bucket = ALL_BUCKETS.find((item) => item.id === bucketId);
      if (bucket) {
        members = await prisma.user.findMany({
          where: {
            ...baseWhere,
            totalSolved: {
              gte: bucket.min,
              ...(bucket.max !== null ? { lte: bucket.max } : {}),
            },
          },
          orderBy: [{ totalSolved: "desc" }, { name: "asc" }],
          select: USER_SELECT,
        });
      }
    }

    return ok({ buckets, total, bucket: bucketId, members });
  } catch (error) {
    return handleError(error);
  }
}
