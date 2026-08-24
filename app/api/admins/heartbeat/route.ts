import { NextResponse } from "next/server";
import { handleError, ok, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** POST /api/admins/heartbeat — update lastActive timestamp for the current admin. */
export async function POST() {
  const { session, response } = await requireAdmin();
  if (response) return response;

  try {
    if (session.user?.email) {
      await prisma.admin.update({
        where: { email: session.user.email },
        data: { lastActive: new Date() },
      });
    }
    return ok({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
