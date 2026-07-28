"use client";

import useSWR, { type SWRConfiguration } from "swr";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin" });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let details: unknown;
    try {
      const body = await response.json();
      message = body.error ?? message;
      details = body.details;
    } catch {
      /* Non-JSON error body — keep the status-based message. */
    }
    throw new ApiError(message, response.status, details);
  }

  return response.json() as Promise<T>;
}

/** POST/PATCH/DELETE helper with the same error shape as `fetcher`. */
export async function mutateJson<T>(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let details: unknown;
    try {
      const payload = await response.json();
      message = payload.error ?? message;
      details = payload.details;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, response.status, details);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const defaults: SWRConfiguration = {
  revalidateOnFocus: false,
  keepPreviousData: true,
  shouldRetryOnError: false,
};

export function useApi<T>(key: string | null, config?: SWRConfiguration) {
  return useSWR<T, ApiError>(key, fetcher<T>, { ...defaults, ...config });
}
