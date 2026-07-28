import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge-safe: authConfig deliberately carries no Prisma/bcrypt imports.
export default NextAuth(authConfig).auth;

export const config = {
  /**
   * Guard every page and API route except:
   *  - /api/auth/*  → the Auth.js endpoints themselves
   *  - /api/sync    → called by GitHub Actions with a bearer secret, not a cookie
   *  - /api/health  → uptime probe
   *  - Next.js internals and static files
   */
  matcher: [
    "/((?!api/auth|api/sync|api/health|_next/static|_next/image|favicon.ico|logo.png|logo.svg|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf)$).*)",
  ],
};
