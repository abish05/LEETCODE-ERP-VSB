import type { NextRequest } from "next/server";
import { z } from "zod";

import { badRequest, handleError, ok, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SETTINGS, SETTING_KEYS } from "@/lib/constants";
import { istToUtcCron } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const rows = await prisma.setting.findMany();
    const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const row of rows) settings[row.key] = row.value;

    const hour = Number(settings[SETTING_KEYS.SYNC_HOUR_IST]) || 19;
    const minute = Number(settings[SETTING_KEYS.SYNC_MINUTE_IST]) || 0;

    return ok({
      settings,
      cron: {
        expression: istToUtcCron(hour, minute),
        hourIST: hour,
        minuteIST: minute,
        readable: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} IST`,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

const patchSchema = z.object({
  syncHourIST: z.number().int().min(0).max(23).optional(),
  syncMinuteIST: z.number().int().min(0).max(59).optional(),
  inactiveDays: z.number().int().min(1).max(365).optional(),
  collegeName: z.string().trim().min(1).max(160).optional(),
});

export async function PATCH(request: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return badRequest("Validation failed", parsed.error.flatten());
    }

    const updates: Array<[string, string]> = [];
    if (parsed.data.syncHourIST !== undefined)
      updates.push([SETTING_KEYS.SYNC_HOUR_IST, String(parsed.data.syncHourIST)]);
    if (parsed.data.syncMinuteIST !== undefined)
      updates.push([
        SETTING_KEYS.SYNC_MINUTE_IST,
        String(parsed.data.syncMinuteIST),
      ]);
    if (parsed.data.inactiveDays !== undefined)
      updates.push([SETTING_KEYS.INACTIVE_DAYS, String(parsed.data.inactiveDays)]);
    if (parsed.data.collegeName !== undefined)
      updates.push([SETTING_KEYS.COLLEGE_NAME, parsed.data.collegeName]);

    await prisma.$transaction(
      updates.map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        }),
      ),
    );

    return ok({ updated: updates.length });
  } catch (error) {
    return handleError(error);
  }
}
