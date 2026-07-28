import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";

import { handleError, ok, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { findInactiveUserIds } from "@/lib/queries";
import { INACTIVE_THRESHOLD_DAYS, SETTING_KEYS } from "@/lib/constants";
import { daysAgo, utcMidnight } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get("role");
    const role =
      roleParam === "STUDENT" || roleParam === "STAFF" ? roleParam : undefined;

    const where: Prisma.UserWhereInput = role ? { role } : {};

    const inactiveSetting = await prisma.setting.findUnique({
      where: { key: SETTING_KEYS.INACTIVE_DAYS },
    });
    const inactiveDays =
      Number(inactiveSetting?.value) || INACTIVE_THRESHOLD_DAYS;

    const [grouped, roleCounts, inactiveIds, weekRows] = await Promise.all([
      prisma.user.groupBy({
        by: ["department"],
        where,
        _count: { _all: true },
        _sum: {
          totalSolved: true,
          easySolved: true,
          mediumSolved: true,
          hardSolved: true,
        },
        _avg: { totalSolved: true, currentStreak: true },
        orderBy: { department: "asc" },
      }),
      prisma.user.groupBy({
        by: ["department", "role"],
        where,
        _count: { _all: true },
      }),
      findInactiveUserIds(inactiveDays),
      prisma.dailySnapshot.findMany({
        // The role filter has to reach the snapshots too, otherwise the
        // staff-only view reports the whole department's weekly total.
        where: {
          date: { gte: daysAgo(6), lte: utcMidnight() },
          ...(role ? { user: { role } } : {}),
        },
        select: { todaySolved: true, user: { select: { department: true } } },
      }),
    ]);

    const inactiveSet = new Set(inactiveIds);

    // Per-department roll-ups that groupBy cannot express directly.
    const [activeTodayRows, inactiveRows] = await Promise.all([
      prisma.user.groupBy({
        by: ["department"],
        where: { ...where, todaySolved: { gt: 0 } },
        _count: { _all: true },
      }),
      prisma.user.findMany({
        where: { ...where, id: { in: [...inactiveSet] } },
        select: { department: true },
      }),
    ]);

    const activeTodayMap = new Map(
      activeTodayRows.map((row) => [row.department, row._count._all]),
    );
    const inactiveMap = new Map<string, number>();
    for (const row of inactiveRows) {
      inactiveMap.set(row.department, (inactiveMap.get(row.department) ?? 0) + 1);
    }
    const weekMap = new Map<string, number>();
    for (const row of weekRows) {
      const dept = row.user.department;
      weekMap.set(dept, (weekMap.get(dept) ?? 0) + row.todaySolved);
    }

    const studentCounts = new Map<string, number>();
    const staffCounts = new Map<string, number>();
    for (const row of roleCounts) {
      const target = row.role === "STAFF" ? staffCounts : studentCounts;
      target.set(row.department, row._count._all);
    }

    // Top / most-active / least-active per department.
    const departments = grouped.map((row) => row.department);
    const highlights = await Promise.all(
      departments.map(async (department) => {
        const scope = { ...where, department };
        const [top, active, least] = await Promise.all([
          prisma.user.findFirst({
            where: scope,
            orderBy: [{ totalSolved: "desc" }, { name: "asc" }],
            select: { name: true, registerNo: true, totalSolved: true },
          }),
          prisma.user.findFirst({
            where: { ...scope, todaySolved: { gt: 0 } },
            orderBy: [{ todaySolved: "desc" }, { name: "asc" }],
            select: { name: true, registerNo: true, todaySolved: true },
          }),
          prisma.user.findFirst({
            where: scope,
            orderBy: [{ totalSolved: "asc" }, { name: "asc" }],
            select: { name: true, registerNo: true, totalSolved: true },
          }),
        ]);
        return { department, top, active, least };
      }),
    );
    const highlightMap = new Map(
      highlights.map((row) => [row.department, row]),
    );

    const rows = grouped.map((row) => {
      const highlight = highlightMap.get(row.department);
      return {
        department: row.department,
        users: row._count._all,
        students: studentCounts.get(row.department) ?? 0,
        staff: staffCounts.get(row.department) ?? 0,
        totalSolved: row._sum.totalSolved ?? 0,
        averageSolved: Math.round((row._avg.totalSolved ?? 0) * 10) / 10,
        averageStreak: Math.round((row._avg.currentStreak ?? 0) * 10) / 10,
        easy: row._sum.easySolved ?? 0,
        medium: row._sum.mediumSolved ?? 0,
        hard: row._sum.hardSolved ?? 0,
        activeToday: activeTodayMap.get(row.department) ?? 0,
        inactive: inactiveMap.get(row.department) ?? 0,
        solvedThisWeek: weekMap.get(row.department) ?? 0,
        topPerformer: highlight?.top ?? null,
        mostActive: highlight?.active ?? null,
        leastActive: highlight?.least ?? null,
      };
    });

    return ok({ rows, inactiveDays });
  } catch (error) {
    return handleError(error);
  }
}
