"use client";

import { useEffect, useRef, useState } from "react";
import {
  Clock,
  Copy,
  Database,
  DownloadCloud,
  Loader2,
  Save,
  ShieldCheck,
  Terminal,
  Upload,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { SyncButton } from "@/components/layout/sync-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { COLLEGE_NAME } from "@/lib/constants";
import { mutateJson, useApi } from "@/lib/hooks";
import { formatDateTime, formatNumber } from "@/lib/utils";

interface SettingsResponse {
  settings: Record<string, string>;
  cron: {
    expression: string;
    hourIST: number;
    minuteIST: number;
    readable: string;
  };
}

interface SyncStatusResponse {
  running: boolean;
  pending: number;
  totalUsers: number;
  last: {
    startedAt: string;
    status: string;
    totalUsers: number;
    succeeded: number;
    failed: number;
    durationMs: number;
    triggeredBy: string;
    message: string | null;
  } | null;
  history: Array<{
    id: string;
    startedAt: string;
    status: string;
    succeeded: number;
    failed: number;
    durationMs: number;
    triggeredBy: string;
  }>;
}

export function SettingsView({
  admin,
}: {
  admin: { name: string; email: string };
}) {
  const { data, mutate } = useApi<SettingsResponse>("/api/settings");
  const { data: sync, mutate: refreshSync } =
    useApi<SyncStatusResponse>("/api/sync");

  const [hour, setHour] = useState("19");
  const [minute, setMinute] = useState("0");
  const [inactiveDays, setInactiveDays] = useState("7");
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const restoreRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!data) return;
    setHour(String(data.cron.hourIST));
    setMinute(String(data.cron.minuteIST));
    setInactiveDays(data.settings.inactive_threshold_days ?? "7");
  }, [data]);

  async function save() {
    setSaving(true);
    try {
      await mutateJson("/api/settings", "PATCH", {
        syncHourIST: Number(hour),
        syncMinuteIST: Number(minute),
        inactiveDays: Number(inactiveDays),
      });
      await mutate();
      toast.success(
        "Settings saved. Update the workflow cron to match the new time.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The settings could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function restore(file: File) {
    setRestoring(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const result = await mutateJson<{
        created: number;
        updated: number;
        skipped: number;
      }>("/api/backup", "POST", payload);

      toast.success(
        `Restored: ${result.created} added, ${result.updated} updated, ${result.skipped} skipped.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The backup file could not be read.",
      );
    } finally {
      setRestoring(false);
      if (restoreRef.current) restoreRef.current.value = "";
    }
  }

  const cron = data?.cron.expression ?? "30 13 * * *";

  return (
    <div className="animate-in-up">
      <PageHeader
        title="Settings"
        description="Scheduler, data maintenance and administrator details."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Scheduler ────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4" />
              Daily sync schedule
            </CardTitle>
            <CardDescription>
              GitHub Actions runs the sync once a day. Set the time you want in
              IST and copy the generated cron expression into the workflow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="hour">Hour (IST, 0–23)</Label>
                <Input
                  id="hour"
                  type="number"
                  min={0}
                  max={23}
                  value={hour}
                  onChange={(event) => setHour(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minute">Minute (0–59)</Label>
                <Input
                  id="minute"
                  type="number"
                  min={0}
                  max={59}
                  value={minute}
                  onChange={(event) => setMinute(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inactive">Inactive threshold (days)</Label>
              <Input
                id="inactive"
                type="number"
                min={1}
                max={365}
                value={inactiveDays}
                onChange={(event) => setInactiveDays(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A user with no solve in this many days is counted as inactive on
                the dashboard and in department analytics.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-secondary/50 p-3">
              <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Terminal className="size-3.5" />
                Cron expression (UTC)
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-card px-3 py-2 font-mono text-sm">
                  {cron}
                </code>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(cron);
                    toast.success("Cron expression copied.");
                  }}
                  aria-label="Copy cron expression"
                >
                  <Copy />
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Paste this into{" "}
                <code className="rounded bg-card px-1">
                  .github/workflows/daily-sync.yml
                </code>
                . GitHub Actions schedules are always UTC, so{" "}
                {data?.cron.readable ?? "19:00 IST"} becomes{" "}
                <code className="rounded bg-card px-1">{cron}</code>.
              </p>
            </div>

            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              Save settings
            </Button>
          </CardContent>
        </Card>

        {/* ── Sync status ──────────────────────────────────────── */}
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4" />
                Synchronisation
              </CardTitle>
              <CardDescription>
                Manual runs process the stalest profiles first, in batches.
              </CardDescription>
            </div>
            <SyncButton label="Run now" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-secondary/60 p-3">
                <p className="tabular text-lg font-bold">
                  {formatNumber(sync?.totalUsers ?? 0)}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Tracked
                </p>
              </div>
              <div className="rounded-lg bg-secondary/60 p-3">
                <p className="tabular text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {formatNumber(
                    Math.max(0, (sync?.totalUsers ?? 0) - (sync?.pending ?? 0)),
                  )}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Synced today
                </p>
              </div>
              <div className="rounded-lg bg-secondary/60 p-3">
                <p className="tabular text-lg font-bold text-amber-600 dark:text-amber-400">
                  {formatNumber(sync?.pending ?? 0)}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Pending
                </p>
              </div>
            </div>

            {sync?.last ? (
              <p className="text-xs text-muted-foreground">
                Last run {formatDateTime(sync.last.startedAt)} ·{" "}
                {sync.last.triggeredBy} · {(sync.last.durationMs / 1000).toFixed(1)}s
                {sync.last.message ? ` — ${sync.last.message}` : ""}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                No sync has been recorded yet.
              </p>
            )}

            <div className="max-h-56 overflow-y-auto scrollbar-thin rounded-lg border border-border">
              <Table>
                <TableHeader className="sticky top-0">
                  <TableRow>
                    <TableHead>Started</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead className="text-right">OK</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(sync?.history ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-6 text-center text-sm text-muted-foreground"
                      >
                        No sync history yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sync!.history.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDateTime(row.startedAt)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.triggeredBy}
                        </TableCell>
                        <TableCell className="tabular text-right text-xs">
                          {formatNumber(row.succeeded)}
                        </TableCell>
                        <TableCell className="tabular text-right text-xs">
                          {formatNumber(row.failed)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              row.status === "SUCCESS"
                                ? "success"
                                : row.status === "PARTIAL"
                                  ? "warning"
                                  : row.status === "RUNNING"
                                    ? "navy"
                                    : "destructive"
                            }
                          >
                            {row.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => refreshSync()}
              className="w-full"
            >
              Refresh status
            </Button>
          </CardContent>
        </Card>

        {/* ── Backup ───────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="size-4" />
              Backup &amp; restore
            </CardTitle>
            <CardDescription>
              Exports the full roster and settings as JSON. Daily snapshots are
              not included — they rebuild themselves from LeetCode.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild variant="outline" className="w-full">
              <a href="/api/backup" download>
                <DownloadCloud />
                Download backup
              </a>
            </Button>

            <input
              ref={restoreRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) restore(file);
              }}
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => restoreRef.current?.click()}
              disabled={restoring}
            >
              {restoring ? <Loader2 className="animate-spin" /> : <Upload />}
              Restore from backup
            </Button>
            <p className="text-xs text-muted-foreground">
              Restoring matches on register number: existing people are updated,
              new ones are added. Nothing is ever deleted.
            </p>
          </CardContent>
        </Card>

        {/* ── Administrator ────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="size-4" />
              Administrator
            </CardTitle>
            <CardDescription>
              This deployment has exactly one account. Students and staff never
              sign in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Signed in as
              </p>
              <p className="mt-1 font-semibold">{admin.name}</p>
              <p className="text-sm text-muted-foreground">{admin.email}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Institution
              </p>
              <p className="mt-1 text-sm font-medium">{COLLEGE_NAME}</p>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              To change the password, update <code>ADMIN_PASSWORD</code> in your
              environment and re-run <code>npm run db:seed</code>. The seed
              script re-hashes the password for the existing account rather than
              creating a second one.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
