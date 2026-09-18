import type { Metadata } from "next";

import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  return (
    <SettingsView
      admin={{
        id: "mock-id",
        name: "Administrator",
        email: "admin@example.com",
      }}
    />
  );
}
