"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Flame,
  GraduationCap,
  Target,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";

import {
  CategoryBarChart,
  DifficultyDonut,
  TrendChart,
} from "@/components/charts";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
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
import { Skeleton } from "@/components/ui/misc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApi } from "@/lib/hooks";
import type { DashboardStats, TopUser } from "@/lib/types";
import { formatDecimal, formatNumber, initials, timeAgo } from "@/lib/utils";

export function DashboardView() {
  const [days, setDays] = useState("30");
  const { data, error, isLoading, mutate } = useApi<DashboardStats>(
    `/api/dashboard?days=${days}`,
    { refreshInterval: 120_000 },
  );

  if (error) {
    return (
      <Card>
        <ErrorState message={error.message} onRetry={() => mutate()} />
      </Card>
    );
  }

  const totals = data?.totals;
  const averages = data?.averages;
  const noUsers = !isLoading && totals?.users === 0;

  return (
    <div className="animate-in-up">
      <PageHeader
        title="Dashboard"
        description="College-wide LeetCode performance at a glance."
        actions={
          <>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[9.5rem]" aria-label="Trend range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="180">Last 180 days</SelectItem>
              </SelectContent>
            </Select>
            <SyncButton />
          </>
        }
      />

      {noUsers ? (
        <Card>
          <EmptyState
            icon={Users}
            title="No users are being tracked yet"
            description="Upload your student and staff spreadsheet to start collecting daily LeetCode statistics."
            action={
              <Button asChild variant="navy" className="mt-1">
                <Link href="/import">Import users</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <SyncBanner sync={data?.lastSync ?? null} loading={isLoading} />

          {/* ── Primary KPIs ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label="Total Users"
              value={totals?.users ?? 0}
              hint={`${formatNumber(totals?.students ?? 0)} students · ${formatNumber(totals?.staff ?? 0)} staff`}
              icon={Users}
              accent="navy"
              loading={isLoading}
            />
            <StatCard
              label="Active Today"
              value={totals?.activeToday ?? 0}
              hint={
                totals?.users
                  ? `${((totals.activeToday / totals.users) * 100).toFixed(0)}% of the college`
                  : undefined
              }
              icon={UserCheck}
              accent="success"
              loading={isLoading}
            />
            <StatCard
              label="Solved Today"
              value={totals?.solvedToday ?? 0}
              hint="problems across all users"
              icon={Target}
              accent="red"
              loading={isLoading}
            />
            <StatCard
              label="Highest Streak"
              value={totals?.highestStreak ?? 0}
              hint="consecutive days"
              icon={Flame}
              accent="gold"
              loading={isLoading}
            />
            <StatCard
              label="Total Solved"
              value={totals?.problemsSolved ?? 0}
              hint="all-time, all users"
              icon={BarChart3}
              accent="navy"
              loading={isLoading}
            />
            <StatCard
              label="Inactive Users"
              value={totals?.inactiveUsers ?? 0}
              hint="no solve in 7 days"
              icon={UserX}
              accent="hard"
              loading={isLoading}
            />
          </div>

          {/* ── Averages + growth ─────────────────────────────────── */}
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label="Avg. Problems"
              value={formatDecimal(averages?.total)}
              hint="per user"
              icon={Activity}
              accent="navy"
              loading={isLoading}
            />
            <StatCard
              label="Avg. Easy"
              value={formatDecimal(averages?.easy)}
              icon={CheckCircle2}
              accent="easy"
              loading={isLoading}
            />
            <StatCard
              label="Avg. Medium"
              value={formatDecimal(averages?.medium)}
              icon={CheckCircle2}
              accent="medium"
              loading={isLoading}
            />
            <StatCard
              label="Avg. Hard"
              value={formatDecimal(averages?.hard)}
              icon={CheckCircle2}
              accent="hard"
              loading={isLoading}
            />
            <StatCard
              label="Weekly Growth"
              value={formatNumber(data?.growth.weeklySolved ?? 0)}
              hint="solved in 7 days"
              trend={data?.growth.weekly}
              icon={TrendingUp}
              accent="success"
              loading={isLoading}
            />
            <StatCard
              label="Monthly Growth"
              value={formatNumber(data?.growth.monthlySolved ?? 0)}
              hint="solved in 30 days"
              trend={data?.growth.monthly}
              icon={CalendarCheck}
              accent="gold"
              loading={isLoading}
            />
          </div>

          {/* ── Trend + difficulty ────────────────────────────────── */}
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Daily activity</CardTitle>
                <CardDescription>
                  Problems solved and how many users were active each day.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[280px] w-full" />
                ) : (data?.trend?.length ?? 0) === 0 ? (
                  <EmptyState
                    icon={Clock}
                    title="No history yet"
                    description="Daily statistics appear here after the first sync completes."
                  />
                ) : (
                  <TrendChart data={data!.trend} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Difficulty mix</CardTitle>
                <CardDescription>
                  Every problem solved across the college.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[240px] w-full" />
                ) : (
                  <DifficultyDonut
                    easy={data?.difficulty.easy ?? 0}
                    medium={data?.difficulty.medium ?? 0}
                    hard={data?.difficulty.hard ?? 0}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Highlights ────────────────────────────────────────── */}
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <HighlightCard
              title="Top performer"
              subtitle="Most problems solved overall"
              icon={Trophy}
              user={data?.topPerformer ?? null}
              unit="solved"
              loading={isLoading}
            />
            <HighlightCard
              title="Most active today"
              subtitle="Highest solve count today"
              icon={Activity}
              user={data?.mostActiveToday ?? null}
              unit="today"
              loading={isLoading}
            />
            <HighlightCard
              title="Longest streak"
              subtitle="Consecutive active days"
              icon={Flame}
              user={data?.longestStreak ?? null}
              unit="days"
              loading={isLoading}
            />
          </div>

          {/* ── Departments ───────────────────────────────────────── */}
          <Card className="mt-4">
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>Average problems by department</CardTitle>
                <CardDescription>
                  Mean problems solved per tracked user.
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/analytics">
                  Full analytics
                  <ArrowUpRight />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (data?.departments?.length ?? 0) === 0 ? (
                <EmptyState
                  icon={GraduationCap}
                  title="No departments yet"
                  description="Departments appear once users are imported."
                />
              ) : (
                <CategoryBarChart
                  data={data!.departments.map((row) => ({
                    department: row.department,
                    average: row.average,
                  }))}
                  xKey="department"
                  yKey="average"
                  label="Avg. solved"
                  colorful
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function SyncBanner({
  sync,
  loading,
}: {
  sync: DashboardStats["lastSync"];
  loading: boolean;
}) {
  if (loading) return <Skeleton className="mb-4 h-12 w-full" />;

  if (!sync) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm">
        <AlertTriangle className="size-4 shrink-0 text-amber-600" />
        <span className="text-amber-800 dark:text-amber-200">
          No sync has run yet. Statistics will be empty until the first
          synchronisation completes.
        </span>
      </div>
    );
  }

  const failed = sync.failed > 0;

  return (
    <div
      className={`mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-2.5 text-sm ${
        failed
          ? "border-amber-500/30 bg-amber-500/8"
          : "border-emerald-500/25 bg-emerald-500/8"
      }`}
    >
      {failed ? (
        <AlertTriangle className="size-4 shrink-0 text-amber-600" />
      ) : (
        <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
      )}
      <span className="font-medium">Last sync {timeAgo(sync.at)}</span>
      <Badge variant={failed ? "warning" : "success"}>
        {formatNumber(sync.succeeded)} synced
        {failed ? ` · ${formatNumber(sync.failed)} failed` : ""}
      </Badge>
      <span className="text-xs text-muted-foreground">
        took {(sync.durationMs / 1000).toFixed(1)}s
      </span>
    </div>
  );
}

function HighlightCard({
  title,
  subtitle,
  icon: Icon,
  user,
  unit,
  loading,
}: {
  title: string;
  subtitle: string;
  icon: typeof Trophy;
  user: TopUser | null;
  unit: string;
  loading: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-4 text-[var(--gold)]" />
        {title}
      </div>

      {loading ? (
        <Skeleton className="mt-4 h-14 w-full" />
      ) : !user ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nothing to show yet.
        </p>
      ) : (
        <Link
          href={`/users/${user.id}`}
          className="mt-4 flex items-center gap-3 rounded-lg transition-opacity hover:opacity-80"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-navy text-sm font-semibold text-white">
            {initials(user.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{user.name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {user.registerNo} · {user.department}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="tabular block text-xl font-bold">
              {formatNumber(user.value)}
            </span>
            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
              {unit}
            </span>
          </span>
        </Link>
      )}

      <p className="mt-3 text-xs text-muted-foreground">{subtitle}</p>
    </Card>
  );
}
