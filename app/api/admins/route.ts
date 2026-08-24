import type { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { badRequest, handleError, ok, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/admins — list all admins (email + name only, no password hashes). */
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const admins = await prisma.admin.findMany({
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return ok({ admins });
  } catch (error) {
    return handleError(error);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

/** POST /api/admins — create a new admin account. */
export async function POST(request: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return badRequest("Validation failed", parsed.error.flatten());
    }

    const { name, email, password } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await prisma.admin.create({
      data: { name, email, passwordHash },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    return ok(admin, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

const deleteSchema = z.object({
  id: z.string().min(1),
});

/** DELETE /api/admins — remove an admin by ID (cannot delete yourself). */
export async function DELETE(request: NextRequest) {
  const { session, response } = await requireAdmin();
  if (response) return response;

  try {
    const parsed = deleteSchema.safeParse(await request.json());
    if (!parsed.success) {
      return badRequest("Validation failed", parsed.error.flatten());
    }

    // Prevent self-deletion
    const target = await prisma.admin.findUnique({
      where: { id: parsed.data.id },
      select: { email: true },
    });

    if (!target) {
      return badRequest("Admin not found.");
    }

    if (target.email === session.user?.email) {
      return badRequest("You cannot delete your own account.");
    }

    // Ensure at least one admin remains
    const count = await prisma.admin.count();
    if (count <= 1) {
      return badRequest("Cannot delete the last administrator.");
    }

    await prisma.admin.delete({ where: { id: parsed.data.id } });
    return ok({ deleted: true });
  } catch (error) {
    return handleError(error);
  }
}
