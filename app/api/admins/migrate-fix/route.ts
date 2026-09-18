import { handleError, ok, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * One-time fix for production: `admins.lastActive` was added to
 * schema.prisma but no migration ever shipped it, so prod is missing the
 * column. Delete this route once it has been called against production.
 */
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "lastActive" TIMESTAMP(3);',
    );
    return ok({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
