"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { ExportMenu } from "@/components/shared/export-menu";
import {
  EMPTY_FILTERS,
  FilterBar,
  type FilterState,
} from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shared/states";
import {
  LeetCodeLink,
  RoleBadge,
  StatusBadge,
  StreakBadge,
  TodayCell,
  UserCell,
} from "@/components/shared/user-cells";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetcher, mutateJson, useApi } from "@/lib/hooks";
import type { Paginated, TrackedUserDTO } from "@/lib/types";
import { buildQuery, formatNumber, timeAgo } from "@/lib/utils";

import { UserFormDialog } from "./user-form-dialog";

type SortKey =
  | "name"
  | "registerNo"
  | "department"
  | "totalSolved"
  | "todaySolved"
  | "currentStreak"
  | "ranking";

export function UsersView() {
  const [filters, setFilters] = useState<FilterState>({ ...EMPTY_FILTERS });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<SortKey>("totalSolved");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TrackedUserDTO | null>(null);
  const [deleting, setDeleting] = useState<TrackedUserDTO | null>(null);
  const [busy, setBusy] = useState(false);

  const query = useMemo(
    () =>
      buildQuery({
        ...filters,
        page,
        pageSize,
        sort,
        dir,
      }),
    [filters, page, pageSize, sort, dir],
  );

  const { data, error, isLoading, mutate } =
    useApi<Paginated<TrackedUserDTO>>(`/api/users${query}`);

  function applyFilters(next: FilterState) {
    setFilters(next);
    setPage(1);
  }

  function toggleSort(key: SortKey) {
    if (sort === key) {
      setDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setDir(key === "name" || key === "registerNo" ? "asc" : "desc");
    }
    setPage(1);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await mutateJson(`/api/users/${deleting.id}`, "DELETE");
      toast.success(`${deleting.name} and their history were removed.`);
      setDeleting(null);
      mutate();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "The user could not be deleted.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function refreshOne(user: TrackedUserDTO) {
    const toastId = toast.loading(`Refreshing ${user.leetcodeUsername}…`);
    try {
      await mutateJson("/api/sync", "POST", { userIds: [user.id] });
      toast.success(`${user.name} refreshed.`, { id: toastId });
      mutate();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "The refresh failed.",
        { id: toastId },
      );
    }
  }

  /** Exports respect the active filters but ignore pagination. */
  async function exportRows() {
    const all = await fetcher<Paginated<TrackedUserDTO>>(
      `/api/users${buildQuery({ ...filters, pageSize: "all", sort, dir })}`,
    );
    return all.rows.map((user) => ({
      "Register No": user.registerNo,
      Name: user.name,
      Department: user.department,
      Year: user.year ?? "—",
      Section: user.section ?? "—",
      Role: user.role === "STAFF" ? "Staff" : "Student",
      "LeetCode ID": user.leetcodeUsername,
      Total: user.totalSolved,
      Today: user.todaySolved,
      Easy: user.easySolved,
      Medium: user.mediumSolved,
      Hard: user.hardSolved,
      Streak: user.currentStreak,
      "Max Streak": user.maxStreak,
      Ranking: user.ranking ?? "—",
      "Contest Rating": user.contestRating ?? "—",
      Status: user.status,
      "Last Synced": user.lastSyncedAt
        ? new Date(user.lastSyncedAt).toLocaleString("en-IN")
        : "Never",
    }));
  }

  const rows = data?.rows ?? [];

  return (
    <div className="animate-in-up">
      <PageHeader
        title="Users"
        description="Every student and staff member whose LeetCode profile is tracked."
        actions={
          <>
            <ExportMenu
              getRows={exportRows}
              baseName="leettrack-users"
              title="Tracked Users"
              subtitle={`${formatNumber(data?.total ?? 0)} records`}
              disabled={isLoading}
            />
            <Button asChild variant="outline" size="sm">
              <Link href="/import">
                <Upload />
                Import
              </Link>
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus />
              Add user
            </Button>
          </>
        }
      />

      <Card className="mb-4 p-3">
        <FilterBar
          value={filters}
          onChange={applyFilters}
          fields={[
            "search",
            "department",
            "role",
            "year",
            "section",
            "status",
            "minSolved",
            "maxSolved",
          ]}
        />
      </Card>

      <Card className="overflow-hidden">
        {error ? (
          <ErrorState message={error.message} onRetry={() => mutate()} />
        ) : isLoading && rows.length === 0 ? (
          <LoadingRows cols={7} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No users match these filters"
            description="Adjust or clear the filters, or import your spreadsheet to get started."
            action={
              <Button asChild variant="navy" className="mt-1">
                <Link href="/import">Import users</Link>
              </Button>
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead
                    label="User"
                    field="name"
                    sort={sort}
                    dir={dir}
                    onSort={toggleSort}
                  />
                  <TableHead>LeetCode ID</TableHead>
                  <TableHead>Role</TableHead>
                  <SortableHead
                    label="Total"
                    field="totalSolved"
                    sort={sort}
                    dir={dir}
                    onSort={toggleSort}
                    align="right"
                  />
                  <SortableHead
                    label="Today"
                    field="todaySolved"
                    sort={sort}
                    dir={dir}
                    onSort={toggleSort}
                    align="right"
                  />
                  <TableHead className="text-right">Easy</TableHead>
                  <TableHead className="text-right">Medium</TableHead>
                  <TableHead className="text-right">Hard</TableHead>
                  <SortableHead
                    label="Streak"
                    field="currentStreak"
                    sort={sort}
                    dir={dir}
                    onSort={toggleSort}
                    align="right"
                  />
                  <TableHead>Status</TableHead>
                  <TableHead>Synced</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="min-w-[200px]">
                      <UserCell user={user} />
                    </TableCell>
                    <TableCell>
                      <LeetCodeLink username={user.leetcodeUsername} />
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={user.role} />
                    </TableCell>
                    <TableCell className="tabular text-right font-semibold">
                      {formatNumber(user.totalSolved)}
                    </TableCell>
                    <TableCell className="text-right">
                      <TodayCell value={user.todaySolved} />
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
                    <TableCell>
                      <StatusBadge
                        status={user.status}
                        syncError={user.syncError}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {timeAgo(user.lastSyncedAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${user.name}`}
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/users/${user.id}`}>
                              <Eye />
                              View profile
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              setEditing(user);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => refreshOne(user)}>
                            <RefreshCw />
                            Refresh from LeetCode
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setDeleting(user)}
                          >
                            <Trash2 />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Pagination
              page={data?.page ?? 1}
              pageSize={data?.pageSize ?? pageSize}
              total={data?.total ?? 0}
              pageCount={data?.pageCount ?? 1}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </Card>

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editing}
        onSaved={() => mutate()}
      />

      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this user?</DialogTitle>
            <DialogDescription>
              <strong>{deleting?.name}</strong> ({deleting?.registerNo}) and
              their entire daily history will be permanently removed. This cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={busy}
            >
              <Trash2 />
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortableHead({
  label,
  field,
  sort,
  dir,
  onSort,
  align = "left",
}: {
  label: string;
  field: SortKey;
  sort: SortKey;
  dir: "asc" | "desc";
  onSort: (field: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort === field;
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-foreground ${
          active ? "text-foreground" : ""
        }`}
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ChevronsUpDown className="size-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}
