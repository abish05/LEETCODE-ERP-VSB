/**
 * Seeds the single administrator account and the default settings.
 *
 * Safe to run repeatedly: it upserts, so re-running after changing
 * ADMIN_PASSWORD simply re-hashes the password for the existing account.
 *
 *   npm run db:seed
 */
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

import { DEFAULT_SETTINGS } from "../lib/constants";

config();

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const name = process.env.ADMIN_NAME ?? "Administrator";

  if (!email || !password) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env before seeding.",
    );
  }

  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters long.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.admin.upsert({
    where: { email },
    create: { email, name, passwordHash },
    update: { name, passwordHash },
  });

  console.log(`✓ Administrator ready: ${admin.email}`);

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      // Never clobber a value the admin has already customised.
      update: {},
    });
  }
  console.log(`✓ ${Object.keys(DEFAULT_SETTINGS).length} default settings ready`);

  const otherAdmins = await prisma.admin.count({
    where: { email: { not: email } },
  });
  if (otherAdmins > 0) {
    console.warn(
      `! ${otherAdmins} other admin account(s) exist. This platform is designed for exactly one.`,
    );
  }

  const users = await prisma.user.count();
  console.log(`\nDatabase currently tracks ${users} user(s).`);
  if (users === 0) {
    console.log("  Next: sign in and upload your spreadsheet at /import");
  }
}

main()
  .catch((error) => {
    console.error("\n✗ Seed failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
