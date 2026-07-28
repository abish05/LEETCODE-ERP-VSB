import type { NextRequest } from "next/server";

import { handleError, ok, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { findInactiveUserIds, solvedBetween } from "@/lib/queries";
import { INACTIVE_THRESHOLD_DAYS, SETTING_KEYS } from "@/lib/constants";
import { daysAgo, growth, utcMidnight } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface TopRow {
  id: string;
  name: string;
  registerNo: string;
  department: string;
  leetcodeUsername: string;
  avatarUrl: string | null;
}

function toTopUser(row: TopRow | null, value: number | null | undefined) {
  if (!row) return null;
  return { ...row, value: value ?? 0 };
}

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const { searchParams } = new URL(request.url);
    const trendDays = Math.min(
      180,
      Math.max(7, Number(searchParams.get("days") ?? 30) || 30),
    );

    const today = utcMidnight();
    const topSelect = {
      id: true,
      name: true,
      registerNo: true,
      department: true,
      leetcodeUsername: true,
      avatarUrl: true,
    };

    const inactiveSetting = await prisma.setting.findUnique({
      where: { key: SETTING_KEYS.INACTIVE_DAYS },
    });
    const inactiveDays =
      Number(inactiveSetting?.value) || INACTIVE_THRESHOLD_DAYS;

    const [
      totalUsers,
      students,
      staff,
      invalidProfiles,
      aggregates,
      activeToday,
      solvedTodayAgg,
      topPerformer,
      mostActiveToday,
      longestStreak,
      trendRows,
      departmentRows,
      lastSync,
      inactiveIds,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.user.count({ where: { role: "STAFF" } }),
      prisma.user.count({ where: { status: "INVALID_PROFILE" } }),
      prisma.user.aggregate({
        _avg: {
          totalSolved: true,
          easySolved: true,
          mediumSolved: true,
          hardSolved: true,
          currentStreak: true,
        },
        _sum: {
          totalSolved: true,
          easySolved: true,
          mediumSolved: true,
          hardSolved: true,
        },
        _max: { currentStreak: true },
      }),
      prisma.user.count({ where: { todaySolved: { gt: 0 } } }),
      prisma.user.aggregate({ _sum: { todaySolved: true } }),
      prisma.user.findFirst({
        orderBy: { totalSolved: "desc" },
        select: { ...topSelect, totalSolved: true },
      }),
      prisma.user.findFirst({
        where: { todaySolved: { gt: 0 } },
        orderBy: { todaySolved: "desc" },
        select: { ...topSelect, todaySolved: true },
      }),
      prisma.user.findFirst({
        orderBy: { currentStreak: "desc" },
        select: { ...topSelect, currentStreak: true },
      }),
      prisma.dailySnapshot.groupBy({
        by: ["date"],
        where: { date: { gte: daysAgo(trendDays - 1) } },
        _sum: { todaySolved: true, totalSolved: true },
        _count: { _all: true },
        orderBy: { date: "asc" },
      }),
      prisma.user.groupBy({
        by: ["department"],
        _count: { _all: true },
        _sum: { totalSolved: true },
        _avg: { totalSolved: true },
        orderBy: { department: "asc" },
      }),
      prisma.syncLog.findFirst({ orderBy: { startedAt: "desc" } }),
      findInactiveUserIds(inactiveDays),
    ]);

    // Active-user counts per day need a second pass: groupBy cannot express
    // "count rows where todaySolved > 0" alongside the sums above.
    const activePerDay = await prisma.dailySnapshot.groupBy({
      by: ["date"],
      where: { date: { gte: daysAgo(trendDays - 1) }, todaySolved: { gt: 0 } },
      _count: { _all: true },
    });
    const activeMap = new Map(
      activePerDay.map((row) => [
        row.date.toISOString().slice(0, 10),
        row._count._all,
      ]),
    );

    const [weekSolved, prevWeekSolved, monthSolved, prevMonthSolved] =
      await Promise.all([
        solvedBetween(daysAgo(6), today),
        solvedBetween(daysAgo(13), daysAgo(7)),
        solvedBetween(daysAgo(29), today),
        solvedBetween(daysAgo(59), daysAgo(30)),
      ]);

    const trend = trendRows.map((row) => {
      const date = row.date.toISOString().slice(0, 10);
      return {
        date,
        solved: row._sum.todaySolved ?? 0,
        activeUsers: activeMap.get(date) ?? 0,
        cumulative: row._sum.totalSolved ?? 0,
      };
    });

    return ok({
      totals: {
        users: totalUsers,
        students,
        staff,
        activeToday,
        solvedToday: solvedTodayAgg._sum.todaySolved ?? 0,
        highestStreak: aggregates._max.currentStreak ?? 0,
        inactiveUsers: inactiveIds.length,
        invalidProfiles,
        problemsSolved: aggregates._sum.totalSolved ?? 0,
      },
      averages: {
        total: aggregates._avg.totalSolved ?? 0,
        easy: aggregates._avg.easySolved ?? 0,
        medium: aggregates._avg.mediumSolved ?? 0,
        hard: aggregates._avg.hardSolved ?? 0,
        streak: aggregates._avg.currentStreak ?? 0,
      },
      difficulty: {
        easy: aggregates._sum.easySolved ?? 0,
        medium: aggregates._sum.mediumSolved ?? 0,
        hard: aggregates._sum.hardSolved ?? 0,
      },
      growth: {
        weekly: growth(weekSolved, prevWeekSolved),
        monthly: growth(monthSolved, prevMonthSolved),
        weeklySolved: weekSolved,
        monthlySolved: monthSolved,
      },
      topPerformer: toTopUser(topPerformer, topPerformer?.totalSolved),
      mostActiveToday: toTopUser(mostActiveToday, mostActiveToday?.todaySolved),
      longestStreak: toTopUser(longestStreak, longestStreak?.currentStreak),
      trend,
      departments: departmentRows.map((row) => ({
        department: row.department,
        users: row._count._all,
        total: row._sum.totalSolved ?? 0,
        average: Math.round((row._avg.totalSolved ?? 0) * 10) / 10,
      })),
      lastSync: lastSync
        ? {
            at: (lastSync.finishedAt ?? lastSync.startedAt).toISOString(),
            status: lastSync.status,
            succeeded: lastSync.succeeded,
            failed: lastSync.failed,
            durationMs: lastSync.durationMs,
          }
        : null,
    });
  } catch (error) {
    return handleError(error);
  }
}
