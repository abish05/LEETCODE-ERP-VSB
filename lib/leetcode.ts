import { sleep } from "./utils";

/**
 * LeetCode does not publish a supported REST API for profile statistics, so we
 * read the same public GraphQL endpoint the profile page itself uses. That
 * makes this layer the most fragile part of the system, and it is written
 * defensively on purpose:
 *
 *  - every field is optional and defaulted, so a schema change degrades to
 *    zeroes instead of throwing;
 *  - 429 / 5xx responses are retried with exponential backoff + jitter;
 *  - a missing profile is reported as `notFound` rather than an error, so the
 *    scheduler can mark the user INVALID_PROFILE and carry on;
 *  - callers are expected to throttle (see `mapWithConcurrency` in the sync job).
 */

const LEETCODE_GRAPHQL = "https://leetcode.com/graphql";

/**
 * `userCalendar` only ever returns a single calendar year. Asking for the
 * current *and* previous year in one request (via aliases) keeps streaks intact
 * across a New Year boundary — otherwise every streak in the college would
 * reset to 1 on January 1st.
 */
const PROFILE_QUERY = /* GraphQL */ `
  query leettrackUserProfile($username: String!, $year: Int!, $prevYear: Int!) {
    matchedUser(username: $username) {
      username
      profile {
        realName
        userAvatar
        ranking
        reputation
        countryName
        school
      }
      submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
          submissions
        }
      }
      submitStats {
        totalSubmissionNum {
          difficulty
          count
          submissions
        }
      }
      currentYear: userCalendar(year: $year) {
        streak
        totalActiveDays
        submissionCalendar
      }
      previousYear: userCalendar(year: $prevYear) {
        streak
        totalActiveDays
        submissionCalendar
      }
    }
    userContestRanking(username: $username) {
      attendedContestsCount
      rating
      globalRanking
      topPercentage
    }
  }
`;

export interface LeetCodeStats {
  username: string;
  realName: string | null;
  avatarUrl: string | null;
  ranking: number | null;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  totalSubmissions: number;
  acceptanceRate: number | null;
  currentStreak: number;
  maxStreak: number;
  totalActiveDays: number;
  contestRating: number | null;
  contestsCount: number;
  /** Submissions recorded by LeetCode's calendar for today (UTC). */
  submissionsToday: number;
  /** Raw `{ "unixSeconds": count }` calendar, already parsed. */
  submissionCalendar: Record<string, number>;
}

export type LeetCodeResult =
  | { ok: true; stats: LeetCodeStats }
  | { ok: false; notFound: true; error: string }
  | { ok: false; notFound: false; error: string };

interface CalendarNode {
  streak?: number | null;
  totalActiveDays?: number | null;
  submissionCalendar?: string | null;
}

interface GraphQLResponse {
  data?: {
    matchedUser?: {
      username?: string;
      profile?: {
        realName?: string | null;
        userAvatar?: string | null;
        ranking?: number | null;
      } | null;
      submitStatsGlobal?: {
        acSubmissionNum?: Array<{
          difficulty?: string;
          count?: number;
          submissions?: number;
        }> | null;
      } | null;
      submitStats?: {
        totalSubmissionNum?: Array<{
          difficulty?: string;
          count?: number;
          submissions?: number;
        }> | null;
      } | null;
      currentYear?: CalendarNode | null;
      previousYear?: CalendarNode | null;
    } | null;
    userContestRanking?: {
      attendedContestsCount?: number | null;
      rating?: number | null;
      globalRanking?: number | null;
      topPercentage?: number | null;
    } | null;
  };
  errors?: Array<{ message?: string }>;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

/** LeetCode usernames: 1–39 chars, letters/digits/underscore/dot/hyphen. */
export function isValidUsername(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return /^[A-Za-z0-9_.-]{1,39}$/.test(trimmed);
}

export function sanitizeUsername(value: string): string {
  let name = value.trim();
  // Admins routinely paste the full profile URL instead of the handle.
  const urlMatch = name.match(
    /^(?:https?:\/\/)?(?:www\.)?leetcode\.com(?:\/[a-z]{2})?\/u(?:ser)?\/([A-Za-z0-9_.-]+)/i,
  );
  if (urlMatch) {
    name = urlMatch[1];
  } else {
    const directMatch = name.match(
      /^(?:https?:\/\/)?(?:www\.)?leetcode\.com\/([A-Za-z0-9_.-]+)/i,
    );
    if (
      directMatch &&
      ![
        "u",
        "user",
        "problem",
        "problems",
        "discuss",
        "contest",
        "explore",
      ].includes(directMatch[1].toLowerCase())
    ) {
      name = directMatch[1];
    }
  }
  // Remove leading @ and any trailing slashes, pipes, or non-username characters
  return name
    .replace(/^@+/, "")
    .replace(/[^A-Za-z0-9_.-]+$/, "")
    .replace(/^[^A-Za-z0-9_.-]+/, "")
    .trim();
}

/** Seconds-since-epoch for UTC midnight of the given day. */
function utcDayStart(date: Date): number {
  return (
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 1000
  );
}

function parseCalendar(raw: string | null | undefined): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, number>;
    }
  } catch {
    /* Malformed calendar — treat as empty rather than failing the whole sync. */
  }
  return {};
}

/**
 * Current streak = consecutive active days ending today, or ending yesterday
 * when today has no activity yet (LeetCode keeps the streak alive until the day
 * rolls over, and so do we — otherwise every report before ~05:30 IST would
 * show a zeroed streak for the whole college).
 */
export function computeCurrentStreak(
  calendar: Record<string, number>,
  now: Date = new Date(),
): number {
  const active = new Set(
    Object.entries(calendar)
      .filter(([, count]) => Number(count) > 0)
      .map(([ts]) => Number(ts)),
  );
  if (active.size === 0) return 0;

  const DAY = 86_400;
  const today = utcDayStart(now);

  let cursor = active.has(today) ? today : today - DAY;
  if (!active.has(cursor)) return 0;

  let streak = 0;
  while (active.has(cursor)) {
    streak++;
    cursor -= DAY;
  }
  return streak;
}

/** Longest run of consecutive active days anywhere in the calendar. */
export function computeMaxStreak(calendar: Record<string, number>): number {
  const days = Object.entries(calendar)
    .filter(([, count]) => Number(count) > 0)
    .map(([ts]) => Number(ts))
    .sort((a, b) => a - b);

  if (days.length === 0) return 0;

  const DAY = 86_400;
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i] - days[i - 1] === DAY ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

function countFor(
  list: Array<{ difficulty?: string; count?: number; submissions?: number }> | null | undefined,
  difficulty: string,
  field: "count" | "submissions" = "count",
): number {
  if (!Array.isArray(list)) return 0;
  const entry = list.find(
    (item) => item?.difficulty?.toLowerCase() === difficulty.toLowerCase(),
  );
  const value = entry?.[field];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export interface FetchOptions {
  maxRetries?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** Fetches one public profile. Never throws — always returns a result object. */
export async function fetchLeetCodeStats(
  rawUsername: string,
  options: FetchOptions = {},
): Promise<LeetCodeResult> {
  const username = sanitizeUsername(rawUsername);
  const maxRetries = options.maxRetries ?? 3;
  const timeoutMs = options.timeoutMs ?? 20_000;

  if (!isValidUsername(username)) {
    return { ok: false, notFound: true, error: "Invalid username format" };
  }

  let lastError = "Unknown error";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff with jitter: 1s, 2s, 4s (±25%).
      const base = 1000 * 2 ** (attempt - 1);
      await sleep(base + Math.random() * base * 0.5);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    options.signal?.addEventListener("abort", () => controller.abort(), {
      once: true,
    });

    try {
      const response = await fetch(LEETCODE_GRAPHQL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Referer: `https://leetcode.com/u/${encodeURIComponent(username)}/`,
          Origin: "https://leetcode.com",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        },
        body: JSON.stringify({
          query: PROFILE_QUERY,
          variables: {
            username,
            year: new Date().getUTCFullYear(),
            prevYear: new Date().getUTCFullYear() - 1,
          },
          operationName: "leettrackUserProfile",
        }),
        signal: controller.signal,
        cache: "no-store",
      });

      if (RETRYABLE_STATUS.has(response.status)) {
        lastError = `LeetCode responded ${response.status}`;
        continue;
      }

      if (!response.ok) {
        return {
          ok: false,
          notFound: response.status === 404,
          error: `LeetCode responded ${response.status}`,
        };
      }

      const payload = (await response.json()) as GraphQLResponse;
      const matched = payload.data?.matchedUser;

      if (!matched || (payload.errors && payload.errors.some(e => /no permission|private|forbidden/i.test(e.message ?? "")))) {
        const message = payload.errors?.[0]?.message ?? "Profile not found";
        // "That user does not exist." is LeetCode's not-found signal.
        const missing =
          /does not exist|not found|no permission|private|forbidden/i.test(message) || !payload.errors || !matched;
        if (missing) {
          return { ok: false, notFound: true, error: message };
        }
        lastError = message;
        continue;
      }

      const ac = matched.submitStatsGlobal?.acSubmissionNum;
      const total = matched.submitStats?.totalSubmissionNum;

      const easySolved = countFor(ac, "Easy");
      const mediumSolved = countFor(ac, "Medium");
      const hardSolved = countFor(ac, "Hard");
      const allSolved = countFor(ac, "All");
      const totalSolved = allSolved || easySolved + mediumSolved + hardSolved;

      const acceptedSubmissions = countFor(ac, "All", "submissions");
      const totalSubmissions = countFor(total, "All", "submissions");
      const acceptanceRate =
        totalSubmissions > 0
          ? (acceptedSubmissions / totalSubmissions) * 100
          : null;

      const calendar = {
        ...parseCalendar(matched.previousYear?.submissionCalendar),
        ...parseCalendar(matched.currentYear?.submissionCalendar),
      };
      const activeDays = Object.values(calendar).filter(
        (count) => Number(count) > 0,
      ).length;
      const today = utcDayStart(new Date());

      const contest = payload.data?.userContestRanking;

      return {
        ok: true,
        stats: {
          username: matched.username ?? username,
          realName: matched.profile?.realName ?? null,
          avatarUrl: matched.profile?.userAvatar ?? null,
          ranking:
            typeof matched.profile?.ranking === "number" &&
            matched.profile.ranking > 0
              ? matched.profile.ranking
              : null,
          totalSolved,
          easySolved,
          mediumSolved,
          hardSolved,
          totalSubmissions,
          acceptanceRate,
          currentStreak: computeCurrentStreak(calendar),
          maxStreak: Math.max(
            computeMaxStreak(calendar),
            matched.currentYear?.streak ?? 0,
            matched.previousYear?.streak ?? 0,
          ),
          totalActiveDays: activeDays,
          contestRating:
            typeof contest?.rating === "number" && contest.rating > 0
              ? Math.round(contest.rating * 100) / 100
              : null,
          contestsCount: contest?.attendedContestsCount ?? 0,
          submissionsToday: Number(calendar[String(today)] ?? 0),
          submissionCalendar: calendar,
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Network request failed";
      lastError =
        message === "The operation was aborted." || message.includes("abort")
          ? `Timed out after ${timeoutMs}ms`
          : message;
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, notFound: false, error: lastError };
}

/** Cheap existence probe used when validating an imported spreadsheet. */
export async function verifyUsername(username: string): Promise<boolean> {
  const result = await fetchLeetCodeStats(username, {
    maxRetries: 1,
    timeoutMs: 10_000,
  });
  return result.ok;
}
