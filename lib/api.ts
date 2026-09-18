import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auth } from "@/auth";

/** Every API route in this app is admin-only unless it says otherwise. */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    return {
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session, response: null };
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message = "Internal server error") {
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Normalises thrown errors into a JSON response — used by every route's catch. */
export function handleError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", details: error.flatten() },
      { status: 400 },
    );
  }

  // Prisma unique-constraint violation.
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  ) {
    const target = (error as { meta?: { target?: string[] } }).meta?.target;
    const field = Array.isArray(target) ? target.join(", ") : "value";
    return NextResponse.json(
      { error: `A record with this ${field} already exists.` },
      { status: 409 },
    );
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2025"
  ) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }

  console.error("[api] Unhandled error:", error);
  const message =
    error instanceof Error ? error.message : "Internal server error";
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Reads `?page=&pageSize=` with sane clamping. */
export function readPagination(searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(
    500,
    Math.max(1, Number(searchParams.get("pageSize") ?? 25) || 25),
  );
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
