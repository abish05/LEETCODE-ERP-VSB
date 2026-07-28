import type { Metadata } from "next";

import { ProfileView } from "./profile-view";

export const metadata: Metadata = { title: "User profile" };

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProfileView userId={id} />;
}
