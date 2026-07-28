"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Flame,
  Hash,
  Medal,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";

import { DifficultyDonut, ProgressLineChart, TrendChart } from "@/components/charts";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { RoleBadge, StatusBadge } from "@/components/shared/user-cells";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DIFFICULTY_COLORS } from "@/lib/constants";
import { useApi } from "@/lib/hooks";
import type { UserHistoryDTO } from "@/lib/types";
import {
  formatDecimal,
  formatNumber,
  formatPercent,
  initials,
  timeAgo,
} from "@/lib/utils";

export function ProfileView({ userId }: { userId: string }) {
  const [days, setDays] = useState("90");
  const { data, error, isLoading, mutate } = useApi<UserHistoryDTO>(
    `/api/users/${userId}/history?days=${days}`,
  );

  if (error) {
    return (
      <Card>
        <ErrorState
          message={
            error.status === 404
              ? "This user no longer exists."
              : error.message
          }
          onRetry={() => mutate()}
        />
      </Card>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-40 w-full" />
        <div className="grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const { user, snapshots, periods, rank } = data;

  // The daily trend uses the per-day delta; cumulative uses the running total.
  const trend = snapshots.map((snapshot) => ({
    date: snapshot.date,
    solved: snapshot.todaySolved,
    activeUsers: snapshot.todaySolved > 0 ? 1 : 0,
  }));

  const solvedTotal = user.totalSolved || 1;

  return (
    <div className="animate-in-up">
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link href="/users">
          <ArrowLeft />
          Back to users
        </Link>
      </Button>

      <PageHeader
        title={user.name}
        description={`${user.registerNo} · ${user.department}${
          user.year ? ` · Year ${user.year}` : ""
        }${user.section ? ` · Section ${user.section}` : ""}`}
        actions={
          <>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[9.5rem]" aria-label="History range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="180">Last 180 days</SelectItem>
                <SelectItem value="365">Last 365 days</SelectItem>
              </SelectContent>
            </Select>
            <Button asChild variant="outline" size="sm">
              <a
                href={`https://leetcode.com/u/${encodeURIComponent(user.leetcodeUsername)}/`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink />
                LeetCode
              </a>
            </Button>
            <SyncButton userIds={[user.id]} label="Refresh" />
          </>
        }
      />

      {/* ── Identity card ────────────────────────────────────────── */}
      <Card className="mb-4 overflow-hidden">
        <div className="brand-gradient px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-white/12 text-xl font-bold text-white ring-1 ring-white/20">
              {initials(user.name)}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold text-white">
                {user.name}
              </p>
              <p className="truncate font-mono text-sm text-white/65">
                {user.leetcodeUsername}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <RoleBadge role={user.role} />
                <StatusBadge status={user.status} syncError={user.syncError} />
                <Badge variant="muted">{user.department}</Badge>
                {user.year ? (
                  <Badge variant="muted">Year {user.year}</Badge>
                ) : null}
                {user.section ? (
                  <Badge variant="muted">Section {user.section}</Badge>
                ) : null}
              </div>
            </div>

            <div className="flex gap-6 text-white">
              <div>
                <p className="tabular text-3xl font-bold">
                  {formatNumber(user.totalSolved)}
                </p>
                <p className="text-[11px] uppercase tracking-wide text-white/55">
                  Total solved
                </p>
              </div>
              <div>
                <p className="tabular text-3xl font-bold text-[var(--gold)]">
                  #{formatNumber(rank.overall)}
                </p>
                <p className="text-[11px] uppercase tracking-wide text-white/55">
                  College rank
                </p>
              </div>
            </div>
          </div>
        </div>

        {user.syncError ? (
          <p className="border-t border-border bg-destructive/8 px-5 py-2.5 text-sm text-destructive">
            Last sync problem: {user.syncError}
          </p>
        ) : null}

        <div className="grid grid-cols-2 divide-x divide-border border-t border-border sm:grid-cols-4 lg:grid-cols-6">
          <MiniStat
            label="Dept. rank"
            value={`#${formatNumber(rank.department)}`}
            hint={`of ${formatNumber(rank.outOf)}`}
          />
          <MiniStat
            label="Global ranking"
            value={user.ranking ? formatNumber(user.ranking) : "—"}
          />
          <MiniStat
            label="Contest rating"
            value={user.contestRating ? formatDecimal(user.contestRating, 0) : "—"}
            hint={
              user.contestsCount > 0
                ? `${user.contestsCount} contests`
                : "no contests"
            }
          />
          <MiniStat
            label="Acceptance"
            value={formatPercent(user.acceptanceRate)}
          />
          <MiniStat
            label="Active days"
            value={formatNumber(user.totalActiveDays)}
          />
          <MiniStat label="Last synced" value={timeAgo(user.lastSyncedAt)} />
        </div>
      </Card>

      {/* ── Period stats ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <StatCard
          label="Today"
          value={periods.today}
          icon={Target}
          accent="red"
        />
        <StatCard
          label="This week"
          value={periods.week}
          icon={CalendarDays}
          accent="navy"
        />
        <StatCard
          label="This month"
          value={periods.month}
          icon={TrendingUp}
          accent="success"
        />
        <StatCard
          label="This year"
          value={periods.year}
          icon={BarChart3}
          accent="navy"
        />
        <StatCard
          label="Current streak"
          value={user.currentStreak}
          hint="days"
          icon={Flame}
          accent="gold"
        />
        <StatCard
          label="Best streak"
          value={user.maxStreak}
          hint="days"
          icon={Trophy}
          accent="gold"
        />
        <StatCard
          label="Contests"
          value={user.contestsCount}
          icon={Medal}
          accent="navy"
        />
      </div>

      {/* ── Charts ───────────────────────────────────────────────── */}
      <Tabs defaultValue="activity" className="mt-6">
        <TabsList>
          <TabsTrigger value="activity">Daily activity</TabsTrigger>
          <TabsTrigger value="progress">Cumulative progress</TabsTrigger>
          <TabsTrigger value="streak">Streak &amp; rank</TabsTrigger>
        </TabsList>

        <TabsContent value="activity">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Problems solved per day</CardTitle>
                <CardDescription>
                  Derived from the change in total solved between consecutive
                  daily snapshots.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {snapshots.length === 0 ? (
                  <EmptyState
                    icon={CalendarDays}
                    title="No history yet"
                    description="This user's chart fills in as daily syncs accumulate."
                  />
                ) : (
                  <TrendChart data={trend} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Difficulty breakdown</CardTitle>
                <CardDescription>All problems solved to date.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <DifficultyDonut
                  easy={user.easySolved}
                  medium={user.mediumSolved}
                  hard={user.hardSolved}
                  height={200}
                />
                <div className="space-y-3">
                  <DifficultyRow
                    label="Easy"
                    value={user.easySolved}
                    total={solvedTotal}
                    color={DIFFICULTY_COLORS.easy}
                  />
                  <DifficultyRow
                    label="Medium"
                    value={user.mediumSolved}
                    total={solvedTotal}
                    color={DIFFICULTY_COLORS.medium}
                  />
                  <DifficultyRow
                    label="Hard"
                    value={user.hardSolved}
                    total={solvedTotal}
                    color={DIFFICULTY_COLORS.hard}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="progress">
          <Card>
            <CardHeader>
              <CardTitle>Cumulative problems solved</CardTitle>
              <CardDescription>
                Running totals by difficulty over the selected period.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {snapshots.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="No history yet"
                  description="Cumulative progress needs at least one daily snapshot."
                />
              ) : (
                <ProgressLineChart
                  data={snapshots}
                  series={[
                    {
                      key: "totalSolved",
                      label: "Total",
                      color: "var(--brand-red)",
                    },
                    {
                      key: "easySolved",
                      label: "Easy",
                      color: DIFFICULTY_COLORS.easy,
                    },
                    {
                      key: "mediumSolved",
                      label: "Medium",
                      color: DIFFICULTY_COLORS.medium,
                    },
                    {
                      key: "hardSolved",
                      label: "Hard",
                      color: DIFFICULTY_COLORS.hard,
                    },
                  ]}
                  height={320}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="streak">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Streak history</CardTitle>
                <CardDescription>
                  Consecutive active days, recorded each sync.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {snapshots.length === 0 ? (
                  <EmptyState icon={Flame} title="No history yet" />
                ) : (
                  <ProgressLineChart
                    data={snapshots}
                    series={[
                      {
                        key: "currentStreak",
                        label: "Streak (days)",
                        color: "var(--gold)",
                      },
                    ]}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Global ranking</CardTitle>
                <CardDescription>
                  LeetCode&rsquo;s worldwide rank — lower is better.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {snapshots.every((snapshot) => snapshot.ranking === null) ? (
                  <EmptyState
                    icon={Award}
                    title="No ranking recorded"
                    description="LeetCode only assigns a rank once a user has solved enough problems."
                  />
                ) : (
                  <ProgressLineChart
                    data={snapshots}
                    series={[
                      {
                        key: "ranking",
                        label: "Global rank",
                        color: "var(--navy-light)",
                      },
                    ]}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MiniStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="px-4 py-3">
      <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <Hash className="size-3" />
        {label}
      </p>
      <p className="tabular mt-1 truncate text-sm font-semibold">{value}</p>
      {hint ? (
        <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function DifficultyRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const percentage = (value / total) * 100;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium" style={{ color }}>
          {label}
        </span>
        <span className="tabular text-muted-foreground">
          {formatNumber(value)} · {percentage.toFixed(0)}%
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} share of solved problems`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
