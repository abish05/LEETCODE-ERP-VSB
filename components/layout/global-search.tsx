"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Search, X } from "lucide-react";

import { useApi } from "@/lib/hooks";
import { cn, initials } from "@/lib/utils";
import type { Paginated, TrackedUserDTO } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce so a 12-character register number is one request, not twelve.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const { data, isLoading } = useApi<Paginated<TrackedUserDTO>>(
    debounced.length >= 2
      ? `/api/users?search=${encodeURIComponent(debounced)}&pageSize=8`
      : null,
  );

  const results = data?.rows ?? [];
  const showPanel = open && debounced.length >= 2;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search name, register no. or LeetCode ID…"
        aria-label="Search users"
        className={cn(
          "h-9 w-full rounded-md border border-input bg-card pl-9 pr-16 text-sm shadow-xs transition-colors",
          "placeholder:text-muted-foreground",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none",
        )}
      />

      {query ? (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-secondary px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground sm:block">
          ⌘K
        </kbd>
      )}

      {showPanel ? (
        <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
          {isLoading ? (
            <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Searching…
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No user matches &ldquo;{debounced}&rdquo;.
            </p>
          ) : (
            <ul className="max-h-[22rem] overflow-y-auto scrollbar-thin py-1">
              {results.map((user) => (
                <li key={user.id}>
                  <Link
                    href={`/users/${user.id}`}
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-secondary"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy text-[11px] font-semibold text-white">
                      {initials(user.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {user.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {user.registerNo} · {user.department} ·{" "}
                        {user.leetcodeUsername}
                      </span>
                    </span>
                    <Badge variant="muted" className="tabular">
                      {user.totalSolved}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
