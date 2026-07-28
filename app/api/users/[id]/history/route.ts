import type { NextRequest } from "next/server";

import { handleError, notFound, ok, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { USER_SELECT } from "@/lib/queries";
import { daysAgo, utcMidnight } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const range = Math.min(
      365,
      Math.max(7, Number(searchParams.get("days") ?? 90) || 90),
    );

    const user = await prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) return notFound("User not found");

    const today = utcMidnight();

    const [snapshots, weekSum, monthSum, yearSum, overallRank, deptRank, deptTotal] =
      await Promise.all([
        prisma.dailySnapshot.findMany({
          where: { userId: id, date: { gte: daysAgo(range) } },
          orderBy: { date: "asc" },
          select: {
            date: true,
            totalSolved: true,
            easySolved: true,
            mediumSolved: true,
            hardSolved: true,
            todaySolved: true,
            currentStreak: true,
            ranking: true,
            contestRating: true,
          },
        }),
        prisma.dailySnapshot.aggregate({
          _sum: { todaySolved: true },
          where: { userId: id, date: { gte: daysAgo(6), lte: today } },
        }),
        prisma.dailySnapshot.aggregate({
          _sum: { todaySolved: true },
          where: { userId: id, date: { gte: daysAgo(29), lte: today } },
        }),
        prisma.dailySnapshot.aggregate({
          _sum: { todaySolved: true },
          where: { userId: id, date: { gte: daysAgo(364), lte: today } },
        }),
        // Rank = how many users are strictly ahead, plus one.
        prisma.user.count({ where: { totalSolved: { gt: user.totalSolved } } }),
        prisma.user.count({
          where: {
            department: user.department,
            totalSolved: { gt: user.totalSolved },
          },
        }),
        prisma.user.count({ where: { department: user.department } }),
      ]);

    return ok({
      user,
      snapshots: snapshots.map((snapshot) => ({
        ...snapshot,
        date: snapshot.date.toISOString().slice(0, 10),
      })),
      periods: {
        today: user.todaySolved,
        week: weekSum._sum.todaySolved ?? 0,
        month: monthSum._sum.todaySolved ?? 0,
        year: yearSum._sum.todaySolved ?? 0,
      },
      rank: {
        overall: overallRank + 1,
        department: deptRank + 1,
        outOf: deptTotal,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
