import type { NextRequest } from "next/server";
import { z } from "zod";

import { badRequest, handleError, ok, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const unreadOnly = searchParams.get("unread") === "true";
    const take = Math.min(
      200,
      Math.max(1, Number(searchParams.get("limit") ?? 60) || 60),
    );

    const rows = await prisma.notification.findMany({
      where: {
        ...(type && type !== "all" ? { type: type as never } : {}),
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        user: { select: { id: true, name: true, registerNo: true } },
      },
    });

    return ok({
      rows: rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        message: row.message,
        read: row.read,
        createdAt: row.createdAt.toISOString(),
        user: row.user,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}

const patchSchema = z.object({
  ids: z.array(z.string()).optional(),
  read: z.boolean().default(true),
  all: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return badRequest("Validation failed", parsed.error.flatten());
    }

    const { ids, read, all } = parsed.data;

    const result = await prisma.notification.updateMany({
      where: all ? {} : { id: { in: ids ?? [] } },
      data: { read },
    });

    return ok({ updated: result.count });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    const result = id
      ? await prisma.notification.deleteMany({ where: { id } })
      : await prisma.notification.deleteMany({});

    return ok({ deleted: result.count });
  } catch (error) {
    return handleError(error);
  }
}
