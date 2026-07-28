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
        const admin = await prisma.admin.findUnique({ where: { email } });

        // Compare against a dummy hash when the account is missing so that a
        // wrong email and a wrong password take the same amount of time.
        const hash =
          admin?.passwordHash ??
          "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu";

        const ok = await bcrypt.compare(parsed.data.password, hash);
        if (!ok || !admin) return null;

        return { id: admin.id, email: admin.email, name: admin.name };
      },
    }),
  ],
});
