import { redirect } from "next/navigation";

export default function Home() {
  // Middleware guards this route, so an unauthenticated visitor is bounced to
  // /login before ever reaching here.
  redirect("/dashboard");
}
