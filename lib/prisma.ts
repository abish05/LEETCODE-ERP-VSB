import { PrismaClient } from "@prisma/client";

/**
 * A single PrismaClient instance is reused across hot-reloads in development and
 * across lambda invocations in production. Creating a new client per request
 * exhausts the Supabase free-tier connection pool very quickly.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
