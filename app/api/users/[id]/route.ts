import type { NextRequest } from "next/server";
import { z } from "zod";

import { badRequest, handleError, notFound, ok, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { USER_SELECT } from "@/lib/queries";
import { isValidUsername, sanitizeUsername } from "@/lib/leetcode";
import { normalizeDepartment } from "@/lib/utils";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  registerNo: z.string().trim().min(1).max(40).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  department: z.string().trim().min(1).max(40).optional(),
  year: z.string().trim().max(4).nullable().optional(),
  section: z.string().trim().max(4).nullable().optional(),
  role: z.enum(["STUDENT", "STAFF"]).optional(),
  leetcodeUsername: z.string().trim().min(1).optional(),
  email: z.string().trim().email().nullable().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE", "INVALID_PROFILE"]).optional(),
});

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });

    if (!user) return notFound("User not found");
    return ok(user);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const { id } = await params;
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return badRequest("Validation failed", parsed.error.flatten());
    }

    const patch = parsed.data;
    const data: Record<string, unknown> = {};

    if (patch.registerNo !== undefined)
      data.registerNo = patch.registerNo.toUpperCase();
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.department !== undefined)
      data.department = normalizeDepartment(patch.department);
    if (patch.role !== undefined) data.role = patch.role;
    if (patch.email !== undefined) data.email = patch.email || null;
    if (patch.status !== undefined) data.status = patch.status;

    // Staff carry no year/section; clearing them keeps the filters honest.
    if (patch.role === "STAFF") {
      data.year = null;
      data.section = null;
    } else {
      if (patch.year !== undefined) data.year = patch.year || null;
      // Upper-cased to match the importer, so "a" and "A" stay one section.
      if (patch.section !== undefined)
        data.section = patch.section?.toUpperCase() || null;
    }

    if (patch.leetcodeUsername !== undefined) {
      const username = sanitizeUsername(patch.leetcodeUsername);
      if (!isValidUsername(username)) {
        return badRequest(
          `"${patch.leetcodeUsername}" is not a valid LeetCode username.`,
        );
      }
      data.leetcodeUsername = username;
      // A new handle invalidates the cached stats until the next sync.
      data.status = patch.status ?? "ACTIVE";
      data.syncError = null;
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: USER_SELECT,
    });

    return ok(user);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const { id } = await params;
    // Snapshots and notifications cascade via the schema.
    await prisma.user.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (error) {
    return handleError(error);
  }
}
