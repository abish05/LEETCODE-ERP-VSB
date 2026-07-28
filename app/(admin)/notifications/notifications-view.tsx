"use client";

import { useState } from "react";
import Link from "next/link";
import { useSWRConfig } from "swr";
import {
  AlertCircle,
  BellOff,
  CheckCheck,
  Flame,
  Info,
  Trash2,
  TrendingUp,
  UserX,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mutateJson, useApi } from "@/lib/hooks";
import type { NotificationDTO } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";

const TYPE_META: Record<
  string,
  { label: string; icon: typeof Info; tone: string }
> = {
  HIGHEST_STREAK: {
    label: "Streak",
    icon: Flame,
    tone: "bg-accent/15 text-amber-700 dark:text-amber-300",
  },
  TOP_DAILY_SOLVER: {
    label: "Top solver",
    icon: TrendingUp,
    tone: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  },
  INACTIVE_USER: {
    label: "Inactive",
    icon: UserX,
    tone: "bg-destructive/12 text-destructive",
  },
  INVALID_PROFILE: {
    label: "Invalid profile",
    icon: AlertCircle,
    tone: "bg-destructive/12 text-destructive",
  },
  USERNAME_CHANGED: {
    label: "Username changed",
    icon: Users,
    tone: "bg-navy/10 text-navy dark:bg-navy-light/40 dark:text-sky-200",
  },
  MILESTONE: {
    label: "Milestone",
    icon: TrendingUp,
    tone: "bg-accent/15 text-amber-700 dark:text-amber-300",
  },
  SYSTEM: {
    label: "System",
    icon: Info,
    tone: "bg-secondary text-muted-foreground",
  },
};

export function NotificationsView() {
  const [type, setType] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const { mutate: globalMutate } = useSWRConfig();

  const key = `/api/notifications?type=${type}&unread=${unreadOnly}&limit=150`;
  const { data, error, isLoading, mutate } =
    useApi<{ rows: NotificationDTO[] }>(key);

  const rows = data?.rows ?? [];
  const unreadCount = rows.filter((row) => !row.read).length;

  async function markAllRead() {
    setBusy(true);
    try {
      await mutateJson("/api/notifications", "PATCH", { all: true, read: true });
      await mutate();
      await globalMutate("/api/notifications/count");
      toast.success("All notifications marked as read.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    setBusy(true);
    try {
      await mutateJson("/api/notifications", "DELETE");
      await mutate();
      await globalMutate("/api/notifications/count");
      toast.success("Notifications cleared.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleRead(row: NotificationDTO) {
    try {
      await mutateJson("/api/notifications", "PATCH", {
        ids: [row.id],
        read: !row.read,
      });
      await mutate();
      await globalMutate("/api/notifications/count");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    }
  }

  return (
    <div className="animate-in-up">
      <PageHeader
        title="Notifications"
        description="Everything worth knowing since the last sync — streaks, top solvers, inactivity and profile problems."
        actions={
          <>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-[11rem]" aria-label="Type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {Object.entries(TYPE_META).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={unreadOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setUnreadOnly((prev) => !prev)}
            >
              Unread only
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={markAllRead}
              disabled={busy || unreadCount === 0}
            >
              <CheckCheck />
              Mark all read
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={busy || rows.length === 0}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 />
              Clear
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        {error ? (
          <ErrorState message={error.message} onRetry={() => mutate()} />
        ) : isLoading && rows.length === 0 ? (
          <LoadingRows rows={6} cols={3} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title="Nothing to report"
            description={
              unreadOnly
                ? "You have read everything. Switch off “Unread only” to see the full history."
                : "Notifications are generated automatically after each daily sync."
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => {
              const meta = TYPE_META[row.type] ?? TYPE_META.SYSTEM;
              const Icon = meta.icon;

              return (
                <li
                  key={row.id}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3.5 transition-colors sm:px-5",
                    row.read ? "opacity-70" : "bg-primary/[0.03]",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-9 shrink-0 place-items-center rounded-full",
                      meta.tone,
                    )}
                  >
                    <Icon className="size-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{row.title}</p>
                      <Badge variant="muted">{meta.label}</Badge>
                      {!row.read ? (
                        <span className="size-1.5 rounded-full bg-primary" />
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {row.message}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{timeAgo(row.createdAt)}</span>
                      {row.user ? (
                        <Link
                          href={`/users/${row.user.id}`}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          View {row.user.name}
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleRead(row)}
                    className="shrink-0 text-xs"
                  >
                    {row.read ? "Mark unread" : "Mark read"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
