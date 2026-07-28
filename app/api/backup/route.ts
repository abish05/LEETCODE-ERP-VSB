import type { NextRequest } from "next/server";
import { z } from "zod";

import { badRequest, handleError, ok, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { isValidUsername, sanitizeUsername } from "@/lib/leetcode";
import { normalizeDepartment } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BACKUP_VERSION = 1;

/**
 * Exports the full roster plus settings as a JSON file the admin can keep off
 * the free-tier database. Daily snapshots are intentionally excluded — they are
 * regenerable, and including a year of them would produce a file too large to
 * serialise inside a serverless response.
 */
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const [users, settings, counts] = await Promise.all([
      prisma.user.findMany({
        orderBy: { registerNo: "asc" },
        select: {
          registerNo: true,
          name: true,
          department: true,
          year: true,
          section: true,
          role: true,
          leetcodeUsername: true,
          email: true,
          status: true,
        },
      }),
      prisma.setting.findMany(),
      prisma.dailySnapshot.count(),
    ]);

    const payload = {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      counts: { users: users.length, snapshots: counts },
      users,
      settings: settings.map((row) => ({ key: row.key, value: row.value })),
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="leettrack-backup-${new Date()
          .toISOString()
          .slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

const restoreSchema = z.object({
  version: z.number().optional(),
  users: z.array(
    z.object({
      registerNo: z.string().trim().min(1),
      name: z.string().trim().min(1),
      department: z.string().trim().min(1),
      year: z.string().nullable().optional(),
      section: z.string().nullable().optional(),
      role: z.enum(["STUDENT", "STAFF"]).default("STUDENT"),
      leetcodeUsername: z.string().trim().min(1),
      email: z.string().nullable().optional(),
      status: z
        .enum(["ACTIVE", "INACTIVE", "INVALID_PROFILE"])
        .default("ACTIVE"),
    }),
  ),
  settings: z
    .array(z.object({ key: z.string(), value: z.string() }))
    .optional(),
});

/** Restores a backup by upserting on register number. Never deletes. */
export async function POST(request: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const parsed = restoreSchema.safeParse(await request.json());
    if (!parsed.success) {
      return badRequest(
        "This does not look like a LeetTrack backup file.",
        parsed.error.flatten(),
      );
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const raw of parsed.data.users) {
      const leetcodeUsername = sanitizeUsername(raw.leetcodeUsername);
      if (!isValidUsername(leetcodeUsername)) {
        skipped++;
        continue;
      }

      const registerNo = raw.registerNo.toUpperCase();
      const isStaff = raw.role === "STAFF";
      const data = {
        name: raw.name,
        department: normalizeDepartment(raw.department),
        year: isStaff ? null : (raw.year ?? null),
        section: isStaff ? null : (raw.section ?? null),
        role: raw.role,
        leetcodeUsername,
        email: raw.email ?? null,
        status: raw.status,
      };

      const existing = await prisma.user.findUnique({
        where: { registerNo },
        select: { id: true },
      });

      try {
        if (existing) {
          await prisma.user.update({ where: { registerNo }, data });
          updated++;
        } else {
          await prisma.user.create({ data: { registerNo, ...data } });
          created++;
        }
      } catch {
        // Almost always a LeetCode username already claimed by another row.
        skipped++;
      }
    }

    if (parsed.data.settings?.length) {
      await prisma.$transaction(
        parsed.data.settings.map((setting) =>
          prisma.setting.upsert({
            where: { key: setting.key },
            create: setting,
            update: { value: setting.value },
          }),
        ),
      );
    }

    return ok({ created, updated, skipped });
  } catch (error) {
    return handleError(error);
  }
}
