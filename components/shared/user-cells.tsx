import Link from "next/link";
import { AlertCircle, Flame } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn, initials } from "@/lib/utils";

export function UserCell({
  user,
  showDepartment = true,
}: {
  user: {
    id: string;
    name: string;
    registerNo: string;
    department: string;
    year?: string | null;
    section?: string | null;
    avatarUrl?: string | null;
  };
  showDepartment?: boolean;
}) {
  const classLabel = [user.year && `Year ${user.year}`, user.section]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/users/${user.id}`}
      className="flex items-center gap-2.5 transition-opacity hover:opacity-75"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy text-[10px] font-semibold text-white">
        {initials(user.name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium leading-tight">
          {user.name}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {user.registerNo}
          {showDepartment ? ` · ${user.department}` : ""}
          {classLabel ? ` · ${classLabel}` : ""}
        </span>
      </span>
    </Link>
  );
}

export function LeetCodeLink({ username }: { username: string }) {
  return (
    <a
      href={`https://leetcode.com/u/${encodeURIComponent(username)}/`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-xs text-primary underline-offset-2 hover:underline"
      title="Open the public LeetCode profile"
    >
      {username}
    </a>
  );
}

export function StreakBadge({ days }: { days: number }) {
  if (days <= 0) {
    return <span className="tabular text-muted-foreground">0</span>;
  }
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-1 font-medium",
        days >= 30
          ? "text-[var(--hard)]"
          : days >= 7
            ? "text-amber-600 dark:text-[var(--medium)]"
            : "text-foreground",
      )}
    >
      <Flame className="size-3.5" />
      {days}
    </span>
  );
}

export function TodayCell({ value }: { value: number }) {
  if (value <= 0) {
    return <span className="tabular text-muted-foreground">0</span>;
  }
  return (
    <span className="tabular font-semibold text-emerald-600 dark:text-emerald-400">
      +{value}
    </span>
  );
}

export function StatusBadge({
  status,
  syncError,
}: {
  status: string;
  syncError?: string | null;
}) {
  if (status === "INVALID_PROFILE") {
    return (
      <Badge variant="destructive" title={syncError ?? undefined}>
        <AlertCircle className="size-3" />
        Invalid
      </Badge>
    );
  }
  if (status === "INACTIVE") return <Badge variant="muted">Inactive</Badge>;
  return <Badge variant="success">Active</Badge>;
}

export function RoleBadge({ role }: { role: string }) {
  return role === "STAFF" ? (
    <Badge variant="navy">Staff</Badge>
  ) : (
    <Badge variant="muted">Student</Badge>
  );
}
