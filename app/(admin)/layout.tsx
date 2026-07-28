import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import { AdminShell } from "@/components/layout/admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Middleware already enforces this; the second check keeps the layout safe if
  // the matcher is ever loosened.
  if (!session?.user) redirect("/login");

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <AdminShell
      admin={{
        name: session.user.name ?? "Administrator",
        email: session.user.email ?? "",
      }}
      signOutAction={handleSignOut}
    >
      {children}
    </AdminShell>
  );
}
