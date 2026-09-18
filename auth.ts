import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { authConfig } from "./auth.config";
import { prisma } from "./lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Login rate limiting, backed by the database instead of Redis — login
 * volume here is a handful of admins, not worth a second piece of infra for.
 * Keyed by email only (not IP): this is a college network, so many
 * legitimate attempts can share one NATed IP, but only an attacker repeatedly
 * targets the same admin email.
 */
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60_000;

async function isRateLimited(key: string): Promise<boolean> {
  const count = await prisma.loginAttempt.count({
    where: { key, createdAt: { gte: new Date(Date.now() - WINDOW_MS) } },
  });
  return count >= MAX_ATTEMPTS;
}

async function recordFailedAttempt(key: string): Promise<void> {
  await prisma.loginAttempt.create({ data: { key } });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.trim().toLowerCase();

        try {
          // Checked before touching bcrypt so a lockout doesn't also cost a
          // ~100ms hash comparison per request.
          if (await isRateLimited(email)) return null;

          const admin = await prisma.admin.findUnique({ where: { email } });

          // Compare against a dummy hash when the account is missing so that a
          // wrong email and a wrong password take the same amount of time.
          const hash =
            admin?.passwordHash ??
            "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu";

          const ok = await bcrypt.compare(parsed.data.password, hash);
          if (!ok || !admin) {
            await recordFailedAttempt(email);
            return null;
          }

          await prisma.loginAttempt.deleteMany({ where: { key: email } });
          return { id: admin.id, email: admin.email, name: admin.name };
        } catch (error) {
          console.error("Database connection failed during login:", error);
          return null;
        }
      },
    }),
  ],
});
