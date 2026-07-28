<div align="center">
  <img src="public/logo.svg" width="140" alt="V.S.B. College of Engineering Technical Campus" />

  <h1>LeetTrack AI</h1>
  <p><strong>Enterprise LeetCode Analytics Platform</strong><br/>
  V.S.B. College of Engineering Technical Campus · Coimbatore – 642109</p>
</div>

---

A centralised dashboard that tracks the LeetCode performance of every student
and staff member in the college.

**Only the administrator signs in.** Students and staff never create accounts —
the admin uploads one spreadsheet, and a scheduled job reads each person's
*public* LeetCode profile once a day and stores a permanent daily snapshot.
Every report, chart and leaderboard is built from those snapshots.

Runs entirely on free tiers: Supabase Postgres + Vercel Hobby + GitHub Actions.

---

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Deployment](#deployment)
- [The spreadsheet format](#the-spreadsheet-format)
- [How the sync works](#how-the-sync-works)
- [Scripts](#scripts)
- [Project layout](#project-layout)
- [Troubleshooting](#troubleshooting)

---

## Features

**Dashboard** — 12 KPI tiles (total users, active today, solved today, highest
streak, averages by difficulty, weekly/monthly growth with trend arrows), a
30-day activity chart, a college-wide difficulty donut, top-performer /
most-active / longest-streak highlight cards, and a department comparison.

**Users** — searchable, sortable, filterable roster with inline add/edit/delete,
per-user "refresh from LeetCode", and Excel/CSV/PDF export honouring the active
filters.

**Individual profile** — identity card with college and department rank, seven
period counters (today / week / month / year / streak / best streak / contests),
plus daily-activity, cumulative-progress, streak-history and global-ranking
charts.

**Daily Report** — a dated snapshot of every profile. Pick any past date and the
table reproduces that day exactly, with page totals and print support.

**Leaderboard** — daily / weekly / monthly / all-time, with a podium for the top
three. Weekly and monthly are summed from snapshots, not guessed.

**Split Report** — how the college distributes across problems-solved bands
(0, 1–10, 11–25, 26–50, 51–100, 101–200, 201–500, 501–1000, 1000+). Click a band
to list exactly who is in it, and export just that band.

**Department & Staff analytics** — per-department totals, averages, streaks,
active-today share, weekly volume, difficulty mix, and top / most-active /
inactive callouts. Staff get a dedicated page separate from students.

**Bulk import** — drag-and-drop .xlsx / .xls / .csv with fuzzy header matching
("Reg No" and "Register Number" both work), row-level validation, and an import
summary listing every skipped row with the reason.

**Notifications** — generated after each sync: new highest streak, top daily
solver, inactive users, invalid profiles, and username changes.

**Settings** — sync schedule (with the exact UTC cron expression to paste into
the workflow), inactivity threshold, sync history, and JSON backup/restore.

Plus: dark mode, keyboard search (<kbd>⌘K</kbd>), responsive down to mobile, and
the college crest throughout.

---

## Architecture

```
                        Administrator (single account)
                                    │
                          Next.js App Router UI
                                    │
                          Next.js API routes
                                    │
                         Prisma  ──  PostgreSQL
                                    │
              ┌─────────────────────┴─────────────────────┐
              │                                           │
     users (current values)                    daily_snapshots (history)
              │                                           │
              └─────────────────────┬─────────────────────┘
                                    │
                     GitHub Actions · once per day
                                    │
                    LeetCode public GraphQL endpoint
```

Two levels of storage, deliberately:

- **`users`** holds each person's latest known figures. Every list, filter and
  leaderboard reads from here, so those pages need no joins.
- **`daily_snapshots`** holds one immutable row per user per day. Every
  historical report, trend chart and weekly/monthly total is derived from here.

`todaySolved` is computed as the difference between today's cumulative total and
the most recent previous snapshot — LeetCode does not expose "problems solved
today" directly.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) · React 19 · TypeScript |
| Styling | Tailwind CSS v4 + hand-rolled shadcn-style components |
| Charts | Recharts |
| Database | PostgreSQL (Supabase free tier) |
| ORM | Prisma 6 |
| Auth | Auth.js (NextAuth v5), credentials, admin only |
| Spreadsheets | SheetJS (`xlsx`) |
| PDF export | jsPDF + autoTable |
| Scheduler | GitHub Actions cron |
| Hosting | Vercel Hobby |

No paid service is required at any point.

---

## Quick start

**Prerequisites:** Node.js 20+ and a PostgreSQL database (local or Supabase).

```bash
git clone <your-repo-url> leettrack-ai
cd leettrack-ai
npm install
```

Create your environment file:

```bash
cp .env.example .env
```

Fill in `DATABASE_URL`, then generate the two secrets:

```bash
openssl rand -base64 32   # → AUTH_SECRET
openssl rand -hex 32      # → CRON_SECRET
```

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` to the credentials you want, then:

```bash
npm run db:deploy   # apply migrations
npm run db:seed     # create the administrator account
npm run dev
```

Open <http://localhost:3000>, sign in, and upload your spreadsheet at
**Bulk Import**. A ready-made example lives at
[`docs/sample-import.xlsx`](docs/sample-import.xlsx).

Then run one sync to populate the statistics:

```bash
npm run sync
```

---

## Deployment

### 1 · Database (Supabase, free)

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → Database → Connection string**:
   - `DATABASE_URL` → the **Transaction pooler** URI (port `6543`), with
     `?pgbouncer=true&connection_limit=1` appended.
   - `DIRECT_URL` → the **Direct connection** URI (port `5432`). Prisma Migrate
     cannot run through the pooler.
3. Apply the schema:

   ```bash
   npm run db:deploy
   npm run db:seed
   ```

> Supabase pauses free projects after ~7 days of inactivity. The daily sync
> counts as activity, so in practice the project stays awake.

### 2 · App (Vercel, free)

1. Push this repository to GitHub and import it at
   [vercel.com/new](https://vercel.com/new).
2. Add the environment variables: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`,
   `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `CRON_SECRET`.
3. Deploy. The build runs `prisma generate && next build`.

### 3 · Scheduler (GitHub Actions, free)

In the repository, go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
| --- | --- |
| `DATABASE_URL` | same as Vercel |
| `DIRECT_URL` | same as Vercel |

`.github/workflows/daily-sync.yml` then runs every day at **13:30 UTC = 19:00
IST**. To change the time, edit the `cron:` line — the Settings page in the app
shows you the exact UTC expression for any IST time you pick.

You can also trigger it by hand from the **Actions** tab (`Run workflow`), with
optional `limit` and `dryRun` inputs.

> **Why does the daily job run in Actions rather than in a Vercel cron?**
> A full college of ~2,000 profiles takes several minutes, and a Vercel Hobby
> function is capped at 60 seconds. Actions has no such limit and talks to the
> database directly. The in-app **Sync now** button still works — it processes
> the stalest profiles in bounded batches and repeats until everyone is done.

---

## The spreadsheet format

| Register No | Name | Department | Year | Section | Role | LeetCode Username |
| --- | --- | --- | --- | --- | --- | --- |
| 23CS001 | Abish A | CSE | 4 | A | Student | abish05 |
| 23CS002 | Arun K | CSE | 4 | A | Student | arun123 |
| 23EC010 | Priya S | ECE | 3 | B | Student | priya_codes |
| STA001 | Dr. Kumar | CSE | - | - | Staff | drkumar |

**Required:** Register No, Name, Department, LeetCode Username.
**Optional:** Year, Section, Role (defaults to Student), Email.

Notes:

- Header matching is fuzzy — `Reg No`, `Register Number`, `Roll No` all map to
  Register No; `LeetCode ID`, `Username`, `Handle` all map to the handle.
- The LeetCode username is the part after `leetcode.com/u/`. Pasting the full
  profile URL works — it is stripped automatically.
- Year accepts `4`, `IV`, or `4th year`. For staff, leave Year/Section blank or
  use `-`.
- Departments are upper-cased and trimmed so `cse ` and `CSE` stay one group.

Every rejected row is reported back with its row number and the reason, so you
can fix the sheet and re-upload. Enable **Update existing records** to overwrite
people who are already in the system instead of counting them as duplicates.

Download a pre-filled template from the Import page, or use
[`docs/sample-import.xlsx`](docs/sample-import.xlsx).

---

## How the sync works

LeetCode publishes no supported API for profile statistics, so this project
reads the same public GraphQL endpoint the profile page itself uses. That makes
it the most fragile part of the system, and `lib/leetcode.ts` is written
defensively:

- Every field is optional and defaulted — a schema change degrades to zeroes
  rather than crashing the run.
- `429` and `5xx` responses are retried with exponential backoff and jitter.
- A missing profile is reported as *not found* (the user is marked
  `INVALID_PROFILE` and a notification is raised) rather than failing the batch.
- A transient network error never overwrites the last good figures.
- Requests run at a bounded concurrency (default 4) with a delay between them.
  We are a guest on that endpoint; the defaults are deliberately polite.
- The calendar is fetched for the **current and previous year** and merged, so
  streaks survive the 1 January boundary.

Tune with `SYNC_CONCURRENCY`, `SYNC_DELAY_MS` and `SYNC_MAX_RETRIES`.

If LeetCode ever changes the endpoint, the queries to update live in one place:
`PROFILE_QUERY` in `lib/leetcode.ts`.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (runs `prisma generate` first) |
| `npm start` | Serve the production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:migrate` | Create + apply a migration (development) |
| `npm run db:seed` | Create/update the administrator and default settings |
| `npm run db:studio` | Prisma Studio |
| `npm run sync` | Sync every profile |
| `npm run sync -- --limit 50` | Sync the 50 stalest profiles |
| `npm run sync -- --dry-run` | Fetch and report without writing |

To change the admin password: update `ADMIN_PASSWORD` in the environment and
re-run `npm run db:seed`. The seed upserts, so it re-hashes the password for the
existing account rather than creating a second one.

---

## Project layout

```
├── app/
│   ├── (admin)/              # Authenticated shell + every admin page
│   │   ├── dashboard/  users/  reports/  analytics/
│   │   ├── import/  notifications/  settings/
│   ├── api/                  # Route handlers
│   ├── login/                # The only public page
│   └── globals.css           # Brand tokens + Tailwind v4 theme
├── components/
│   ├── ui/                   # Button, Card, Table, Dialog, Select …
│   ├── layout/               # Sidebar, topbar, search, sync button
│   ├── shared/               # Filters, export menu, pagination, states
│   └── charts/               # Recharts wrappers
├── lib/
│   ├── leetcode.ts           # Public GraphQL client (retries, streaks)
│   ├── sync.ts               # The synchronisation engine
│   ├── import.ts             # Spreadsheet parsing and validation
│   ├── queries.ts            # Shared Prisma filter/sort builders
│   └── prisma.ts  utils.ts  api.ts  export.ts  hooks.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── scripts/
│   ├── seed.ts               # Administrator + defaults
│   ├── sync-leetcode.ts      # The daily job
│   └── generate-logo.mjs     # Regenerates public/logo.svg
├── .github/workflows/
│   └── daily-sync.yml
└── docs/
    └── sample-import.xlsx
```

---

## Troubleshooting

**"Can't reach database server"** — On Supabase, check the project is not
paused, and that `DIRECT_URL` uses port `5432` (migrations cannot run through
the `6543` pooler).

**Sign-in does nothing** — `AUTH_SECRET` must be set in the deployment
environment. Confirm the admin exists by re-running `npm run db:seed`.

**Everyone shows 0 solved** — No sync has run yet. Press **Sync now**, or run
the workflow manually from the Actions tab.

**A user is marked "Invalid"** — The handle does not resolve on LeetCode. Open
their profile at `leetcode.com/u/<username>` to confirm, then correct it on the
Users page. It re-validates on the next sync.

**Sync reports many failures at once** — LeetCode is rate-limiting. Lower
`SYNC_CONCURRENCY` to `2` and raise `SYNC_DELAY_MS` to `800`.

**Replacing the crest** — Drop the official artwork in as `public/logo.svg`.
Nothing else needs to change; `components/brand.tsx` reads that one path.

---

<div align="center">
  <sub>Built for V.S.B. College of Engineering Technical Campus · <em>Hard Work Is Key To Success</em></sub>
</div>
