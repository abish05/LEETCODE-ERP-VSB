import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.admin.findMany();
  console.log("Admins in DB:");
  admins.forEach(a => console.log(`- ${a.email}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
