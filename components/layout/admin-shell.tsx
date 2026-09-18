"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AdminShell({
  admin,
  signOutAction,
  children,
}: {
  admin: { name: string; email: string };
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever navigation happens on mobile.
  useEffect(() => setSidebarOpen(false), [pathname]);

  return (
    <div className="min-h-dvh bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-[264px]">
        <Topbar
          admin={admin}
          onOpenSidebar={() => setSidebarOpen(true)}
          signOutAction={signOutAction}
        />
        <main className="px-4 py-6 lg:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
