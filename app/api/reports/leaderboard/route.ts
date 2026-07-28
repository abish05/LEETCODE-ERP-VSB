import type { NextRequest } from "next/server";

import { handleError, ok, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { buildUserWhere, USER_SELECT } from "@/lib/queries";
import { daysAgo, utcMidnight } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Period = "daily" | "weekly" | "monthly" | "overall";

const WINDOW_DAYS: Record<Exclude<Period, "daily" | "overall">, number> = {
  weekly: 7,
  monthly: 30,
};

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const { searchParams } = new URL(request.url);
    const userWhere = buildUserWhere(searchParams);

    const period = (searchParams.get("period") ?? "overall") as Period;
    const wantsAll = searchParams.get("pageSize") === "all";
    const limit = wantsAll
      ? 5000
      : Math.min(500, Math.max(10, Number(searchParams.get("limit") ?? 100) || 100));

    // ── Daily and overall read straight off the denormalised columns ──
    if (period === "daily" || period === "overall") {
      const sortField = period === "daily" ? "todaySolved" : "totalSolved";
      const users = await prisma.user.findMany({
        where: userWhere,
        orderBy: [
          { [sortField]: "desc" },
          { totalSolved: "desc" },
          { name: "asc" },
        ],
        select: USER_SELECT,
        take: limit,
      });

      return ok({
        period,
        rows: users.map((user, index) => ({
          ...user,
          rank: index + 1,
          periodSolved: period === "daily" ? user.todaySolved : user.totalSolved,
        })),
      });
    }

    // ── Weekly / monthly need the snapshot sums ──────────────────────
    const days = WINDOW_DAYS[period] ?? 7;
    const from = daysAgo(days - 1);
    const to = utcMidnight();

    // Restrict the aggregation to users matching the filters, so a department
    // filter does not silently rank the whole college.
    const matching = await prisma.user.findMany({
      where: userWhere,
      select: { id: true },
    });
    const matchingIds = matching.map((row) => row.id);

    if (matchingIds.length === 0) return ok({ period, rows: [] });

    const grouped = await prisma.dailySnapshot.groupBy({
      by: ["userId"],
      where: { userId: { in: matchingIds }, date: { gte: from, lte: to } },
      _sum: { todaySolved: true },
      orderBy: { _sum: { todaySolved: "desc" } },
      take: limit,
    });

    const totals = new Map(
      grouped.map((row) => [row.userId, row._sum.todaySolved ?? 0]),
    );

    const users = await prisma.user.findMany({
      where: { id: { in: [...totals.keys()] } },
      select: USER_SELECT,
    });
    const byId = new Map(users.map((user) => [user.id, user]));

    const rows = grouped
      .map((row) => {
        const user = byId.get(row.userId);
        if (!user) return null;
        return { ...user, periodSolved: totals.get(row.userId) ?? 0 };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort(
        (a, b) => b.periodSolved - a.periodSolved || b.totalSolved - a.totalSolved,
      )
      .map((row, index) => ({ ...row, rank: index + 1 }));

    return ok({ period, rows, from: from.toISOString().slice(0, 10) });
  } catch (error) {
    return handleError(error);
  }
}
