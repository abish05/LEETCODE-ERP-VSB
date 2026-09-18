import type { NextRequest } from "next/server";

import { badRequest, handleError, ok, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Temporary, read-only: verifies the login rate limiter is recording attempts. Delete after use. */
export async function GET(request: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  const email = new URL(request.url).searchParams.get("email");
  if (!email) return badRequest("Pass ?email=");

  try {
    const rows = await prisma.loginAttempt.findMany({
      where: { key: email.trim().toLowerCase() },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    return ok({ count: rows.length, timestamps: rows.map((r) => r.createdAt) });
  } catch (error) {
    return handleError(error);
  }
}
