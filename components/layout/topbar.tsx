"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Menu, UserCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApi } from "@/lib/hooks";
import { initials } from "@/lib/utils";
import { ALL_NAV_ITEMS } from "./nav-items";
import { GlobalSearch } from "./global-search";
import { SyncButton } from "./sync-button";
import { ThemeToggle } from "./theme-toggle";

function usePageTitle() {
  const pathname = usePathname();
  if (pathname.startsWith("/users/") && pathname !== "/users") {
    return "User Profile";
  }
  const match = ALL_NAV_ITEMS.find((item) => item.href === pathname);
  return match?.label ?? "Dashboard";
}

export function Topbar({
  admin,
  onOpenSidebar,
  signOutAction,
}: {
  admin: { name: string; email: string };
  onOpenSidebar: () => void;
  signOutAction: () => Promise<void>;
}) {
  const title = usePageTitle();
  const { data: unread } = useApi<{ unread: number }>(
    "/api/notifications/count",
    { refreshInterval: 60_000 },
  );
  const count = unread?.unread ?? 0;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onOpenSidebar}
          className="lg:hidden"
          aria-label="Open navigation"
        >
          <Menu />
        </Button>

        <h1 className="shrink-0 text-sm font-semibold tracking-tight sm:text-base">
          {title}
        </h1>

        <div className="ml-auto flex flex-1 items-center justify-end gap-2">
          <div className="hidden flex-1 justify-end md:flex">
            <GlobalSearch />
          </div>

          <SyncButton className="hidden sm:inline-flex" />

          <Button
            variant="ghost"
            size="icon-sm"
            asChild
            className="relative"
            aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
          >
            <Link href="/notifications">
              <Bell />
              {count > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">
                  {count > 99 ? "99+" : count}
                </span>
              ) : null}
            </Link>
          </Button>

          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="grid size-8 place-items-center rounded-full bg-navy text-[11px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                aria-label="Account menu"
              >
                {initials(admin.name)}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="font-normal">
                <span className="block text-sm font-semibold">{admin.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {admin.email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <UserCircle2 />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild variant="destructive">
                <form action={signOutAction} className="w-full">
                  <button type="submit" className="flex w-full items-center gap-2">
                    <LogOut />
                    Sign out
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search drops below the bar on narrow screens. */}
      <div className="border-t border-border px-4 py-2 md:hidden">
        <GlobalSearch />
      </div>
    </header>
  );
}
