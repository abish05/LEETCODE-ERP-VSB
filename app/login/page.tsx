import type { Metadata } from "next";

import { CollegeLogo } from "@/components/brand";
import {
  APP_NAME,
  APP_TAGLINE,
  COLLEGE_LOCATION,
  COLLEGE_MOTTO,
  COLLEGE_NAME,
} from "@/lib/constants";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Administrator sign-in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr] pb-[44px]">
      {/* ── Brand panel ─────────────────────────────────────────────── */}
      <section className="brand-gradient relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">

        <div className="relative flex items-center gap-4">
          <span className="grid size-16 place-items-center rounded-2xl bg-white p-2 shadow-lg">
            <CollegeLogo size={56} priority />
          </span>
          <div className="leading-tight text-white">
            <p className="text-lg font-bold tracking-tight">{APP_NAME}</p>
            <p className="text-sm text-white/60">{APP_TAGLINE}</p>
          </div>
        </div>

        <div className="relative max-w-lg text-white">
          <h1 className="text-4xl font-bold leading-[1.15] tracking-tight">
            Every student&rsquo;s progress,
            <span className="block text-[var(--gold)]">
              in one daily picture.
            </span>
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-white/70">
            LeetTrack AI syncs the public LeetCode profile of every student and
            staff member once a day, builds a permanent history, and turns it
            into department-wise reports, leaderboards and split analytics — no
            student login required.
          </p>

          <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-white/15 pt-7">
            {[
              ["Daily", "Automated sync"],
              ["Zero", "Student logins"],
              ["Full", "Historical trend"],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="text-2xl font-bold text-[var(--gold)]">
                  {value}
                </dt>
                <dd className="mt-1 text-xs uppercase tracking-wide text-white/50">
                  {label}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative text-xs text-white/45">
          <p className="font-semibold text-white/70">{COLLEGE_NAME}</p>
          <p className="mt-1">
            {COLLEGE_LOCATION} &nbsp;·&nbsp; {COLLEGE_MOTTO}
          </p>
        </div>
      </section>

      {/* ── Form panel ──────────────────────────────────────────────── */}
      <section className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <CollegeLogo size={84} priority />
            <p className="mt-4 text-lg font-bold tracking-tight">{APP_NAME}</p>
            <p className="text-xs text-muted-foreground">{COLLEGE_NAME}</p>
          </div>

          <div className="mb-8 hidden lg:block">
            <h2 className="text-2xl font-bold tracking-tight">
              Administrator sign-in
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              This portal is restricted to the college administrator.
            </p>
          </div>

          <LoginForm />

          <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
            Students and staff never sign in here. Their public LeetCode
            profiles are tracked automatically once they are imported.
          </p>
        </div>
      </section>

      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-[#ffc107] py-3 text-center text-sm font-medium text-black">
        © 2026 VSB College of Engineering Technical Campus | All Rights Reserved. Developed By <span className="font-bold">abish, anand</span>
      </footer>
    </main>
  );
}
