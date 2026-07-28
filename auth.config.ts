import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe half of the Auth.js configuration.
 *
 * `middleware.ts` runs on the Edge runtime, which cannot load Prisma or bcrypt.
 * Everything that needs Node lives in `auth.ts`; this file holds only the
 * routing rules, so both runtimes can share one source of truth.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8, // 8-hour admin session
  },
  trustHost: true,
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const isOnLogin = nextUrl.pathname.startsWith("/login");

      if (isOnLogin) {
        // Already signed in? Skip the login screen.
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      // API routes must answer in JSON. Redirecting an expired XHR to the HTML
      // login page would surface as an unparseable-response error in the UI.
      if (!isLoggedIn && nextUrl.pathname.startsWith("/api/")) {
        return Response.json(
          { error: "Your session has expired. Please sign in again." },
          { status: 401 },
        );
      }

      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.email = user.email as string;
        token.name = user.name as string;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? token.sub ?? "";
      }
      return session;
    },
  },
  providers: [], // Filled in by auth.ts (Node runtime only).
} satisfies NextAuthConfig;

export default authConfig;
