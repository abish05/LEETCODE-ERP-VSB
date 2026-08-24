import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Try to add the column. If it exists, it will throw an error, which we catch.
    await prisma.$executeRawUnsafe('ALTER TABLE "admins" ADD COLUMN "lastLoginAt" TIMESTAMP(3);');
    return NextResponse.json({ success: true, message: 'Column added successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
