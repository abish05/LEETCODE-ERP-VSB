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
  const adminsToSeed = [
    { email: "abishstk@gmail.com", name: "VSBCETC Administrator", password: "password123" },
    { email: "admin@vsbcetc.edu.in", name: "ADMIN", password: "password123" },
    { email: "poorna6493@gmail.com", name: "POORNA CHANDRAN", password: "password123" }
  ];

  for (const adminData of adminsToSeed) {
    const passwordHash = await bcrypt.hash(adminData.password, 12);
    const admin = await prisma.admin.upsert({
      where: { email: adminData.email },
      create: { email: adminData.email, name: adminData.name, passwordHash },
      update: { name: adminData.name, passwordHash },
    });
    console.log(`✓ Administrator ready: ${admin.email}`);
  }

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      // Never clobber a value the admin has already customised.
      update: {},
    });
  }
  console.log(`✓ ${Object.keys(DEFAULT_SETTINGS).length} default settings ready`);

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
