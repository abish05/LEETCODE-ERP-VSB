"use client";

import { useMemo, useState } from "react";
import { Layers3, X } from "lucide-react";

import { CategoryBarChart } from "@/components/charts";
import { ExportMenu } from "@/components/shared/export-menu";
import {
  EMPTY_FILTERS,
  FilterBar,
  type FilterState,
} from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/states";
import {
  LeetCodeLink,
  RoleBadge,
  StreakBadge,
  UserCell,
} from "@/components/shared/user-cells";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetcher, useApi } from "@/lib/hooks";
import type { SplitBucketDTO, TrackedUserDTO } from "@/lib/types";
import { buildQuery, cn, formatNumber } from "@/lib/utils";

interface SplitResponse {
  buckets: SplitBucketDTO[];
  total: number;
  bucket: string | null;
  members: TrackedUserDTO[];
}

export function SplitReportView() {
  const [filters, setFilters] = useState<FilterState>({ ...EMPTY_FILTERS });
  const [bucket, setBucket] = useState<string | null>(null);

  const query = useMemo(
    () => buildQuery({ ...filters, bucket: bucket ?? "" }),
    [filters, bucket],
  );

  const { data, error, isLoading, mutate } = useApi<SplitResponse>(
    `/api/reports/split${query}`,
  );

  const buckets = data?.buckets ?? [];
  const selected = buckets.find((item) => item.id === bucket) ?? null;
  const members = data?.members ?? [];

  async function exportSummary() {
    const summary = await fetcher<SplitResponse>(
      `/api/reports/split${buildQuery(filters)}`,
    );
    return summary.buckets.map((item) => ({
      Range: item.label,
      Users: item.count,
      "Share (%)": item.percentage.toFixed(1),
    }));
  }

  async function exportMembers() {
    if (!bucket) return [];
    const detail = await fetcher<SplitResponse>(
      `/api/reports/split${buildQuery({ ...filters, bucket })}`,
    );
    return detail.members.map((user) => ({
      Name: user.name,
      "Register No": user.registerNo,
      "LeetCode ID": user.leetcodeUsername,
      Department: user.department,
      Year: user.year ?? "—",
      Section: user.section ?? "—",
      Role: user.role === "STAFF" ? "Staff" : "Student",
      Solved: user.totalSolved,
      Easy: user.easySolved,
      Medium: user.mediumSolved,
      Hard: user.hardSolved,
      Streak: user.currentStreak,
    }));
  }

  return (
    <div className="animate-in-up">
      <PageHeader
        title="Split Report"
        description="How the college is distributed across problems-solved bands. Click a band to see who is in it."
        actions={
          <ExportMenu
            getRows={exportSummary}
            baseName="leettrack-split-summary"
            title="Split Report — Summary"
            disabled={isLoading}
          />
        }
      />

      <Card className="mb-4 p-3">
        <FilterBar
          value={filters}
          onChange={(next) => {
            setFilters(next);
            setBucket(null);
          }}
          fields={["search", "department", "role", "year", "section"]}
        />
      </Card>

      {error ? (
        <Card>
          <ErrorState message={error.message} onRetry={() => mutate()} />
        </Card>
      ) : (
        <>
          {/* ── Band summary ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {isLoading && buckets.length === 0
              ? Array.from({ length: 9 }).map((_, index) => (
                  <Skeleton key={index} className="h-24 w-full" />
                ))
              : buckets.map((item) => (
                  <button
                    key={item.id}
                    onClick={() =>
                      setBucket((prev) => (prev === item.id ? null : item.id))
                    }
                    disabled={item.count === 0}
                    className={cn(
                      "rounded-lg border bg-card p-4 text-left transition-all",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      item.count === 0
                        ? "cursor-default opacity-55"
                        : "hover:-translate-y-0.5 hover:shadow-md",
                      bucket === item.id
                        ? "border-primary ring-2 ring-primary/25"
                        : "border-border",
                    )}
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="tabular mt-1.5 text-2xl font-bold">
                      {formatNumber(item.count)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {item.count === 1 ? "user" : "users"} ·{" "}
                      {item.percentage.toFixed(1)}%
                    </p>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-500"
                        style={{ width: `${Math.min(100, item.percentage)}%` }}
                      />
                    </div>
                  </button>
                ))}
          </div>

          {/* ── Distribution chart ───────────────────────────────── */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Distribution</CardTitle>
              <CardDescription>
                {formatNumber(data?.total ?? 0)} users across{" "}
                {buckets.length} bands.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading && buckets.length === 0 ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (data?.total ?? 0) === 0 ? (
                <EmptyState
                  icon={Layers3}
                  title="No users match these filters"
                />
              ) : (
                <CategoryBarChart
                  data={buckets.map((item) => ({
                    label: item.label,
                    count: item.count,
                  }))}
                  xKey="label"
                  yKey="count"
                  label="Users"
                  colorful
                  vertical
                  height={340}
                />
              )}
            </CardContent>
          </Card>

          {/* ── Drill-down ───────────────────────────────────────── */}
          {selected ? (
            <Card className="mt-4 overflow-hidden">
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle>
                    {selected.label} · {formatNumber(selected.count)}{" "}
                    {selected.count === 1 ? "user" : "users"}
                  </CardTitle>
                  <CardDescription>
                    Everyone whose total solved count falls in this band.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <ExportMenu
                    getRows={exportMembers}
                    baseName={`leettrack-split-${selected.label.replace(/[^\w]+/g, "-")}`}
                    title={`Split Report — ${selected.label}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setBucket(null)}
                    aria-label="Close band details"
                  >
                    <X />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <Skeleton className="mx-5 mb-5 h-40" />
                ) : members.length === 0 ? (
                  <EmptyState
                    icon={Layers3}
                    title="Nobody in this band"
                    className="py-10"
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>LeetCode ID</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Solved</TableHead>
                        <TableHead className="text-right">Easy</TableHead>
                        <TableHead className="text-right">Medium</TableHead>
                        <TableHead className="text-right">Hard</TableHead>
                        <TableHead className="text-right">Streak</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="min-w-[190px]">
                            <UserCell user={user} showDepartment={false} />
                          </TableCell>
                          <TableCell>
                            <LeetCodeLink username={user.leetcodeUsername} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {user.department}
                          </TableCell>
                          <TableCell>
                            <RoleBadge role={user.role} />
                          </TableCell>
                          <TableCell className="tabular text-right font-semibold">
                            {formatNumber(user.totalSolved)}
                          </TableCell>
                          <TableCell className="tabular text-right text-[var(--easy)]">
                            {formatNumber(user.easySolved)}
                          </TableCell>
                          <TableCell className="tabular text-right text-amber-600 dark:text-[var(--medium)]">
                            {formatNumber(user.mediumSolved)}
                          </TableCell>
                          <TableCell className="tabular text-right text-[var(--hard)]">
                            {formatNumber(user.hardSolved)}
                          </TableCell>
                          <TableCell className="text-right">
                            <StreakBadge days={user.currentStreak} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
