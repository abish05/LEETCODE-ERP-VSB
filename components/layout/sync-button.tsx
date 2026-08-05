"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { mutateJson } from "@/lib/hooks";

interface SyncResponse {
  total: number;
  succeeded: number;
  failed: number;
  invalidProfiles: number;
  remaining: number;
  durationMs: number;
  status: string;
}

/** Stop after this many batches so a stuck run can never loop forever. */
const MAX_BATCHES = 60;

export function SyncButton({
  userIds,
  label = "Sync now",
  variant = "outline",
  size = "sm",
  className,
}: {
  userIds?: string[];
  label?: string;
  variant?: "outline" | "default" | "navy" | "ghost" | "secondary";
  size?: "sm" | "default" | "icon-sm";
  className?: string;
}) {
  const [running, setRunning] = useState(false);
  const { mutate } = useSWRConfig();

  async function run() {
    setRunning(true);
    const single = Boolean(userIds?.length);
    const toastId = toast.loading(
      single
        ? "Refreshing profile from LeetCode…"
        : "Syncing profiles from LeetCode…",
    );

    const totals = { synced: 0, failed: 0, invalid: 0 };
    const startedAt = Date.now();
    let prevRemaining = -1;

    try {
      // A full sync is processed in server-side batches (each call has to
      // finish inside the serverless time limit), so keep going until the
      // backend reports nothing left for today.
      for (let batch = 0; batch < MAX_BATCHES; batch++) {
        const result = await mutateJson<SyncResponse>("/api/sync", "POST", {
          userIds,
        });

        totals.synced += result.succeeded;
        totals.failed += result.failed;
        totals.invalid += result.invalidProfiles;

        if (
          single ||
          result.remaining === 0 ||
          result.total === 0 ||
          result.remaining === prevRemaining
        ) {
          break;
        }
        prevRemaining = result.remaining;

        toast.loading(
          `Synced ${totals.synced.toLocaleString("en-IN")} profiles · ${result.remaining.toLocaleString("en-IN")} remaining…`,
          { id: toastId },
        );
      }

      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      if (totals.synced === 0 && totals.failed === 0 && totals.invalid === 0) {
        toast.success(
          `No profiles to sync (${seconds}s).`,
          { id: toastId },
        );
      } else if (totals.failed === 0) {
        toast.success(
          `Synced ${totals.synced.toLocaleString("en-IN")} profile${totals.synced === 1 ? "" : "s"} in ${seconds}s.`,
          { id: toastId },
        );
      } else {
        toast.warning(
          `Synced ${totals.synced.toLocaleString("en-IN")}; ${totals.failed} failed (${totals.invalid} invalid profile${totals.invalid === 1 ? "" : "s"}).`,
          { id: toastId },
        );
      }

      // Refresh every cached endpoint rather than guessing which ones moved.
      await mutate(
        (key) => typeof key === "string" && key.startsWith("/api/"),
        undefined,
        { revalidate: true },
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The sync could not be completed.",
        { id: toastId },
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={run}
      disabled={running}
      className={className}
      title={label}
    >
      <RefreshCw className={running ? "animate-spin" : undefined} />
      {size === "icon-sm" ? null : running ? "Syncing…" : label}
    </Button>
  );
}
