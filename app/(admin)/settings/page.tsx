import type { Metadata } from "next";

import { auth } from "@/auth";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();

  return (
    <SettingsView
      admin={{
        name: session?.user?.name ?? "Administrator",
        email: session?.user?.email ?? "",
      }}
    />
  );
}
