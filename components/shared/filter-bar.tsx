"use client";

import { Filter, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApi } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export interface FilterState {
  search: string;
  department: string;
  role: string;
  year: string;
  section: string;
  status: string;
  minSolved: string;
  maxSolved: string;
  minStreak: string;
}

export const EMPTY_FILTERS: FilterState = {
  search: "",
  department: "all",
  role: "all",
  year: "all",
  section: "all",
  status: "all",
  minSolved: "",
  maxSolved: "",
  minStreak: "",
};

export type FilterField = keyof FilterState;

interface MetaResponse {
  departments: string[];
  years: string[];
  sections: string[];
}

export function countActiveFilters(filters: FilterState): number {
  return (Object.keys(EMPTY_FILTERS) as FilterField[]).filter(
    (key) => filters[key] !== EMPTY_FILTERS[key],
  ).length;
}

export function FilterBar({
  value,
  onChange,
  fields = ["search", "department", "role", "year", "section", "status"],
  className,
  children,
}: {
  value: FilterState;
  onChange: (next: FilterState) => void;
  fields?: FilterField[];
  className?: string;
  children?: React.ReactNode;
}) {
  const { data: meta } = useApi<MetaResponse>("/api/meta");
  const active = countActiveFilters(value);

  const set = (key: FilterField, next: string) =>
    onChange({ ...value, [key]: next });

  const show = (field: FilterField) => fields.includes(field);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {show("search") ? (
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={value.search}
            onChange={(event) => set("search", event.target.value)}
            placeholder="Search name, register no., LeetCode ID…"
            aria-label="Search"
            className="pl-9"
          />
        </div>
      ) : null}

      {show("department") ? (
        <Select
          value={value.department}
          onValueChange={(next) => set("department", next)}
        >
          <SelectTrigger className="w-auto min-w-[9rem]" aria-label="Department">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {(meta?.departments ?? []).map((department) => (
              <SelectItem key={department} value={department}>
                {department}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {show("role") ? (
        <Select value={value.role} onValueChange={(next) => set("role", next)}>
          <SelectTrigger className="w-auto min-w-[7.5rem]" aria-label="Role">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="STUDENT">Students</SelectItem>
            <SelectItem value="STAFF">Staff</SelectItem>
          </SelectContent>
        </Select>
      ) : null}

      {show("year") ? (
        <Select value={value.year} onValueChange={(next) => set("year", next)}>
          <SelectTrigger className="w-auto min-w-[6.5rem]" aria-label="Year">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {(meta?.years ?? []).map((year) => (
              <SelectItem key={year} value={year}>
                Year {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {show("section") ? (
        <Select
          value={value.section}
          onValueChange={(next) => set("section", next)}
        >
          <SelectTrigger className="w-auto min-w-[7rem]" aria-label="Section">
            <SelectValue placeholder="Section" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sections</SelectItem>
            {(meta?.sections ?? []).map((section) => (
              <SelectItem key={section} value={section}>
                Section {section}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {show("status") ? (
        <Select value={value.status} onValueChange={(next) => set("status", next)}>
          <SelectTrigger className="w-auto min-w-[8rem]" aria-label="Status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
            <SelectItem value="INVALID_PROFILE">Invalid profile</SelectItem>
          </SelectContent>
        </Select>
      ) : null}

      {show("minSolved") ? (
        <Input
          type="number"
          min={0}
          inputMode="numeric"
          value={value.minSolved}
          onChange={(event) => set("minSolved", event.target.value)}
          placeholder="Min solved"
          aria-label="Minimum problems solved"
          className="w-28"
        />
      ) : null}

      {show("maxSolved") ? (
        <Input
          type="number"
          min={0}
          inputMode="numeric"
          value={value.maxSolved}
          onChange={(event) => set("maxSolved", event.target.value)}
          placeholder="Max solved"
          aria-label="Maximum problems solved"
          className="w-28"
        />
      ) : null}

      {show("minStreak") ? (
        <Input
          type="number"
          min={0}
          inputMode="numeric"
          value={value.minStreak}
          onChange={(event) => set("minStreak", event.target.value)}
          placeholder="Min streak"
          aria-label="Minimum streak"
          className="w-28"
        />
      ) : null}

      {active > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({ ...EMPTY_FILTERS })}
          className="text-muted-foreground"
        >
          <X />
          Clear ({active})
        </Button>
      ) : (
        <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
          <Filter className="size-3.5" />
          No filters applied
        </span>
      )}

      {children}
    </div>
  );
}

/** Serialises a FilterState into the query params every report API accepts. */
export function filtersToQuery(filters: FilterState): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, val] of Object.entries(filters)) {
    if (val && val !== "all") params[key] = val;
  }
  return params;
}
