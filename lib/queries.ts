import { Prisma, type Role, type UserStatus } from "@prisma/client";

import { prisma } from "./prisma";
import { utcMidnight } from "./utils";

/**
 * Translates the shared filter query-string into a Prisma `where` clause.
 * Every list/report endpoint funnels through here so a filter behaves
 * identically on the Users page, the Daily Report and the exports.
 */
export function buildUserWhere(
  searchParams: URLSearchParams,
): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};
  const and: Prisma.UserWhereInput[] = [];

  const search = searchParams.get("search")?.trim();
  if (search) {
    and.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { registerNo: { contains: search, mode: "insensitive" } },
        { leetcodeUsername: { contains: search, mode: "insensitive" } },
        { department: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  const department = searchParams.get("department");
  if (department && department !== "all") where.department = department;

  const role = searchParams.get("role");
  if (role === "STUDENT" || role === "STAFF") where.role = role as Role;

  const year = searchParams.get("year");
  if (year && year !== "all") where.year = year;

  const section = searchParams.get("section");
  if (section && section !== "all") where.section = section;

  const status = searchParams.get("status");
  if (status && status !== "all") where.status = status as UserStatus;

  const minSolved = Number(searchParams.get("minSolved"));
  const maxSolved = Number(searchParams.get("maxSolved"));
  const hasMin = searchParams.get("minSolved") && Number.isFinite(minSolved);
  const hasMax = searchParams.get("maxSolved") && Number.isFinite(maxSolved);
  if (hasMin || hasMax) {
    where.totalSolved = {
      ...(hasMin ? { gte: minSolved } : {}),
      ...(hasMax ? { lte: maxSolved } : {}),
    };
  }

  const minStreak = Number(searchParams.get("minStreak"));
  if (searchParams.get("minStreak") && Number.isFinite(minStreak)) {
    where.currentStreak = { gte: minStreak };
  }

  const minToday = Number(searchParams.get("minToday"));
  if (searchParams.get("minToday") && Number.isFinite(minToday)) {
    where.todaySolved = { gte: minToday };
  }

  if (and.length > 0) where.AND = and;
  return where;
}

const SORTABLE = new Set([
  "name",
  "registerNo",
  "department",
  "totalSolved",
  "easySolved",
  "mediumSolved",
  "hardSolved",
  "todaySolved",
  "currentStreak",
  "maxStreak",
  "ranking",
  "contestRating",
  "lastSyncedAt",
  "createdAt",
]);

/**
 * Prisma only accepts the `{ sort, nulls }` form on nullable columns — passing
 * it for a non-nullable Int throws "Expected SortOrder, provided Object".
 */
const NULLABLE_SORT_FIELDS = new Set([
  "ranking",
  "contestRating",
  "lastSyncedAt",
]);

export function orderByField(
  field: string,
  direction: "asc" | "desc",
  nulls: "first" | "last" = "last",
): Record<string, unknown> {
  return NULLABLE_SORT_FIELDS.has(field)
    ? { [field]: { sort: direction, nulls } }
    : { [field]: direction };
}

export function buildUserOrderBy(
  searchParams: URLSearchParams,
  fallback: Prisma.UserOrderByWithRelationInput = { totalSolved: "desc" },
): Prisma.UserOrderByWithRelationInput[] {
  const sort = searchParams.get("sort");
  const direction = searchParams.get("dir") === "asc" ? "asc" : "desc";

  if (sort && SORTABLE.has(sort)) {
    return [
      // Un-synced users have no ranking; keep them at the bottom.
      orderByField(sort, direction) as Prisma.UserOrderByWithRelationInput,
      { name: "asc" },
    ];
  }
  return [fallback, { name: "asc" }];
}

/** The columns every report needs; keeps payloads small on 2,000-row exports. */
export const USER_SELECT = {
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
  totalSolved: true,
  easySolved: true,
  mediumSolved: true,
  hardSolved: true,
  todaySolved: true,
  currentStreak: true,
  maxStreak: true,
  ranking: true,
  contestRating: true,
  contestsCount: true,
  totalActiveDays: true,
  acceptanceRate: true,
  avatarUrl: true,
  lastSyncedAt: true,
  syncError: true,
} satisfies Prisma.UserSelect;

/**
 * Sum of `todaySolved` per user over a window — the honest way to answer
 * "how much did this cohort actually solve this week?", because the denormalised
 * `users.todaySolved` column only ever holds the latest day.
 */
export async function solvedBetween(
  from: Date,
  to: Date,
  userIds?: string[],
): Promise<number> {
  const result = await prisma.dailySnapshot.aggregate({
    _sum: { todaySolved: true },
    where: {
      date: { gte: from, lte: to },
      ...(userIds?.length ? { userId: { in: userIds } } : {}),
    },
  });
  return result._sum.todaySolved ?? 0;
}

/** Users with no solve at all in the trailing `days` window. */
export async function findInactiveUserIds(days: number): Promise<string[]> {
  const since = utcMidnight();
  since.setUTCDate(since.getUTCDate() - days + 1);

  const [allUsers, activeRows] = await Promise.all([
    prisma.user.findMany({ select: { id: true } }),
    prisma.dailySnapshot.groupBy({
      by: ["userId"],
      where: { date: { gte: since }, todaySolved: { gt: 0 } },
      _sum: { todaySolved: true },
    }),
  ]);

  const active = new Set(activeRows.map((row) => row.userId));
  return allUsers.map((u) => u.id).filter((id) => !active.has(id));
}
