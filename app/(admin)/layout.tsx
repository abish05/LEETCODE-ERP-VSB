import { redirect } from "next/navigation";

import { AdminShell } from "@/components/layout/admin-shell";

import { AdminHeartbeat } from "@/components/layout/admin-heartbeat";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AdminHeartbeat />
      <AdminShell
        admin={{
          name: "Administrator",
          email: "admin@example.com",
        }}
      >
        {children}
      </AdminShell>
    </>
  );
}
