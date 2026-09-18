import { handleError, ok, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * One-time fix for production: creates the `login_attempts` table backing
 * the login rate limiter, since this project applies schema changes by hand
 * rather than running `prisma migrate deploy` on every build. Delete this
 * route once it has been called against production.
 */
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "login_attempts" (
        "id" TEXT NOT NULL,
        "key" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "login_attempts_key_createdAt_idx" ON "login_attempts"("key", "createdAt");
    `);
    return ok({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
