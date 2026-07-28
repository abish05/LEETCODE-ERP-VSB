import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { badRequest, handleError, ok, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { parseSpreadsheet, type RowIssue } from "@/lib/import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB — comfortably over 5,000 rows.
const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".csv"];

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const form = await request.formData();
    const file = form.get("file");
    const updateExisting = form.get("updateExisting") === "true";

    if (!(file instanceof File)) {
      return badRequest("No file was uploaded.");
    }
    if (file.size === 0) {
      return badRequest("The uploaded file is empty.");
    }
    if (file.size > MAX_BYTES) {
      return badRequest(
        `The file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 8 MB.`,
      );
    }

    const lower = file.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      return badRequest(
        "Unsupported file type. Upload an .xlsx, .xls or .csv file.",
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseSpreadsheet(buffer, file.name);

    if (parsed.missingColumns.length > 0) {
      return badRequest(
        `The file is missing required column(s): ${parsed.missingColumns.join(", ")}.`,
        { missingColumns: parsed.missingColumns },
      );
    }

    const issues: RowIssue[] = [...parsed.issues];
    let created = 0;
    let updated = 0;

    // ── Detect collisions against rows already in the database ───────
    const registerNos = parsed.valid.map((row) => row.registerNo);
    const usernames = parsed.valid.map((row) => row.leetcodeUsername);

    const existing = await prisma.user.findMany({
      where: {
        OR: [
          { registerNo: { in: registerNos } },
          { leetcodeUsername: { in: usernames, mode: "insensitive" } },
        ],
      },
      select: { id: true, registerNo: true, leetcodeUsername: true },
    });

    const byRegisterNo = new Map(existing.map((row) => [row.registerNo, row]));
    const byUsername = new Map(
      existing.map((row) => [row.leetcodeUsername.toLowerCase(), row]),
    );

    for (const row of parsed.valid) {
      const matchByRegister = byRegisterNo.get(row.registerNo);
      const matchByUsername = byUsername.get(row.leetcodeUsername.toLowerCase());

      // The LeetCode handle belongs to a *different* person already — that is
      // always a conflict, never an update.
      if (
        matchByUsername &&
        (!matchByRegister || matchByUsername.id !== matchByRegister.id)
      ) {
        issues.push({
          rowNumber: row.rowNumber,
          registerNo: row.registerNo,
          leetcodeUsername: row.leetcodeUsername,
          reason: `LeetCode username "${row.leetcodeUsername}" is already assigned to ${matchByUsername.registerNo}`,
          kind: "duplicate",
        });
        continue;
      }

      if (matchByRegister) {
        if (!updateExisting) {
          issues.push({
            rowNumber: row.rowNumber,
            registerNo: row.registerNo,
            leetcodeUsername: row.leetcodeUsername,
            reason: `Register number ${row.registerNo} already exists`,
            kind: "duplicate",
          });
          continue;
        }

        try {
          await prisma.user.update({
            where: { registerNo: row.registerNo },
            data: {
              name: row.name,
              department: row.department,
              year: row.year,
              section: row.section,
              role: row.role,
              leetcodeUsername: row.leetcodeUsername,
              email: row.email,
            },
          });
          updated++;
        } catch (error) {
          issues.push({
            rowNumber: row.rowNumber,
            registerNo: row.registerNo,
            leetcodeUsername: row.leetcodeUsername,
            reason:
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === "P2002"
                ? "Conflicts with another existing record"
                : "Could not be updated",
            kind: "duplicate",
          });
        }
        continue;
      }

      try {
        await prisma.user.create({
          data: {
            registerNo: row.registerNo,
            name: row.name,
            department: row.department,
            year: row.year,
            section: row.section,
            role: row.role,
            leetcodeUsername: row.leetcodeUsername,
            email: row.email,
          },
        });
        created++;
        // Guard against two spreadsheet rows racing for the same handle.
        byUsername.set(row.leetcodeUsername.toLowerCase(), {
          id: "new",
          registerNo: row.registerNo,
          leetcodeUsername: row.leetcodeUsername,
        });
      } catch (error) {
        issues.push({
          rowNumber: row.rowNumber,
          registerNo: row.registerNo,
          leetcodeUsername: row.leetcodeUsername,
          reason:
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
              ? "Duplicate register number or LeetCode username"
              : "Could not be created",
          kind: "duplicate",
        });
      }
    }

    const duplicates = issues.filter((issue) => issue.kind === "duplicate").length;
    const invalid = issues.filter((issue) => issue.kind === "invalid").length;

    await prisma.importLog.create({
      data: {
        fileName: file.name,
        totalRows: parsed.totalRows,
        successful: created,
        updated,
        duplicates,
        invalid,
        errors: issues.slice(0, 500) as unknown as Prisma.InputJsonValue,
      },
    });

    if (created > 0 || updated > 0) {
      await prisma.notification.create({
        data: {
          type: "SYSTEM",
          title: "Bulk import completed",
          message: `${file.name}: ${created} added, ${updated} updated, ${duplicates} duplicate, ${invalid} invalid.`,
        },
      });
    }

    return ok({
      fileName: file.name,
      totalRows: parsed.totalRows,
      created,
      updated,
      duplicates,
      invalid,
      issues: issues.slice(0, 300),
      missingColumns: [],
    });
  } catch (error) {
    return handleError(error);
  }
}

/** Recent import history for the Import page. */
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const rows = await prisma.importLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
    });

    return ok({
      rows: rows.map((row) => ({
        id: row.id,
        fileName: row.fileName,
        totalRows: row.totalRows,
        successful: row.successful,
        updated: row.updated,
        duplicates: row.duplicates,
        invalid: row.invalid,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}
