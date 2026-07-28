import type { NextRequest } from "next/server";

import { handleError, ok, readPagination, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { buildUserWhere, orderByField, USER_SELECT } from "@/lib/queries";
import { toISODate, utcMidnight } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * The Daily Report is snapshot-driven so any past date can be reproduced
 * exactly. The one exception is *today* before the first sync of the day has
 * run — there is no snapshot yet, so we fall back to the live user rows rather
 * than showing the admin an empty table.
 */
export async function GET(request: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const { searchParams } = new URL(request.url);
    const userWhere = buildUserWhere(searchParams);

    const requested = searchParams.get("date");
    const todayISO = toISODate();
    const dateISO = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested)
      ? requested
      : todayISO;
    const date = new Date(`${dateISO}T00:00:00.000Z`);

    const wantsAll = searchParams.get("pageSize") === "all";
    const { page, pageSize, skip, take } = readPagination(searchParams);

    const sort = searchParams.get("sort") ?? "totalSolved";
    const dir = searchParams.get("dir") === "asc" ? "asc" : "desc";
    const snapshotSortable = new Set([
      "totalSolved",
      "todaySolved",
      "easySolved",
      "mediumSolved",
      "hardSolved",
      "currentStreak",
      "ranking",
    ]);

    const snapshotCount = await prisma.dailySnapshot.count({
      where: { date, user: userWhere },
    });

    // ── Live fallback for an un-synced today ─────────────────────────
    if (snapshotCount === 0 && dateISO === todayISO) {
      const [rows, total] = await Promise.all([
        prisma.user.findMany({
          where: userWhere,
          orderBy: snapshotSortable.has(sort)
            ? [orderByField(sort, dir), { name: "asc" }]
            : [{ totalSolved: "desc" }, { name: "asc" }],
          select: USER_SELECT,
          ...(wantsAll ? {} : { skip, take }),
        }),
        prisma.user.count({ where: userWhere }),
      ]);

      return ok({
        date: dateISO,
        source: "live" as const,
        synced: false,
        rows,
        total,
        page: wantsAll ? 1 : page,
        pageSize: wantsAll ? total : pageSize,
        pageCount: wantsAll ? 1 : Math.max(1, Math.ceil(total / pageSize)),
      });
    }

    const snapshots = await prisma.dailySnapshot.findMany({
      where: { date, user: userWhere },
      orderBy: snapshotSortable.has(sort)
        ? [orderByField(sort, dir)]
        : [{ totalSolved: "desc" }],
      select: {
        totalSolved: true,
        easySolved: true,
        mediumSolved: true,
        hardSolved: true,
        todaySolved: true,
        currentStreak: true,
        maxStreak: true,
        ranking: true,
        contestRating: true,
        acceptanceRate: true,
        totalActiveDays: true,
        lastSyncedAt: true,
        user: {
          select: {
            id: true,
            registerNo: true,
            name: true,
            department: true,
            year: true,
            section: true,
            role: true,
            leetcodeUsername: true,
            email: true,
            status: true,
            avatarUrl: true,
            syncError: true,
            contestsCount: true,
          },
        },
      },
      ...(wantsAll ? {} : { skip, take }),
    });

    // Flatten snapshot + user into the same shape the live branch returns.
    const rows = snapshots.map(({ user, lastSyncedAt, ...stats }) => ({
      ...user,
      ...stats,
      lastSyncedAt: lastSyncedAt.toISOString(),
    }));

    return ok({
      date: dateISO,
      source: "snapshot" as const,
      synced: true,
      rows,
      total: snapshotCount,
      page: wantsAll ? 1 : page,
      pageSize: wantsAll ? snapshotCount : pageSize,
      pageCount: wantsAll ? 1 : Math.max(1, Math.ceil(snapshotCount / pageSize)),
    });
  } catch (error) {
    return handleError(error);
  }
}

/** Dates that actually have snapshots, for the report's date picker. */
export async function POST() {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const rows = await prisma.dailySnapshot.findMany({
      distinct: ["date"],
      select: { date: true },
      orderBy: { date: "desc" },
      take: 400,
    });

    return ok({
      dates: rows.map((row) => row.date.toISOString().slice(0, 10)),
      today: toISODate(utcMidnight()),
    });
  } catch (error) {
    return handleError(error);
  }
}
