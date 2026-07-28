import type { NextRequest } from "next/server";
import { z } from "zod";

import { badRequest, handleError, ok, readPagination, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { buildUserOrderBy, buildUserWhere, USER_SELECT } from "@/lib/queries";
import { isValidUsername, sanitizeUsername } from "@/lib/leetcode";
import { normalizeDepartment } from "@/lib/utils";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  registerNo: z.string().trim().min(1, "Register number is required").max(40),
  name: z.string().trim().min(1, "Name is required").max(120),
  department: z.string().trim().min(1, "Department is required").max(40),
  year: z.string().trim().max(4).nullable().optional(),
  section: z.string().trim().max(4).nullable().optional(),
  role: z.enum(["STUDENT", "STAFF"]).default("STUDENT"),
  leetcodeUsername: z.string().trim().min(1, "LeetCode username is required"),
  email: z.string().trim().email().nullable().optional().or(z.literal("")),
});

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const { searchParams } = new URL(request.url);
    const where = buildUserWhere(searchParams);
    const orderBy = buildUserOrderBy(searchParams);

    // `pageSize=all` powers the exports, which need every matching row.
    const wantsAll = searchParams.get("pageSize") === "all";
    const { page, pageSize, skip, take } = readPagination(searchParams);

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy,
        select: USER_SELECT,
        ...(wantsAll ? {} : { skip, take }),
      }),
      prisma.user.count({ where }),
    ]);

    return ok({
      rows,
      total,
      page: wantsAll ? 1 : page,
      pageSize: wantsAll ? total : pageSize,
      pageCount: wantsAll ? 1 : Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return badRequest("Validation failed", parsed.error.flatten());
    }

    const data = parsed.data;
    const leetcodeUsername = sanitizeUsername(data.leetcodeUsername);

    if (!isValidUsername(leetcodeUsername)) {
      return badRequest(
        `"${data.leetcodeUsername}" is not a valid LeetCode username.`,
      );
    }

    const isStaff = data.role === "STAFF";

    const user = await prisma.user.create({
      data: {
        registerNo: data.registerNo.toUpperCase(),
        name: data.name,
        department: normalizeDepartment(data.department),
        year: isStaff ? null : data.year || null,
        // Upper-cased to match the importer, so "a" and "A" stay one section.
        section: isStaff ? null : data.section?.toUpperCase() || null,
        role: data.role,
        leetcodeUsername,
        email: data.email || null,
      },
      select: USER_SELECT,
    });

    return ok(user, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
