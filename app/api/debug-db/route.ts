import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    databaseUrl: process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@'),
    directUrl: process.env.DIRECT_URL?.replace(/:[^:@]*@/, ':***@'),
    rawDatabaseUrl: process.env.DATABASE_URL,
    rawDirectUrl: process.env.DIRECT_URL,
  });
}
