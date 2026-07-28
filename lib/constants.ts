export const APP_NAME = "LeetTrack AI";
export const APP_TAGLINE = "Enterprise LeetCode Analytics Platform";
export const COLLEGE_NAME = "V.S.B. College of Engineering Technical Campus";
export const COLLEGE_SHORT = "VSBCETC";
export const COLLEGE_LOCATION = "Coimbatore – 642109";
export const COLLEGE_MOTTO = "Hard Work Is Key To Success";

/** Buckets used by the Split Report. `max: null` means "and above". */
export const SPLIT_BUCKETS = [
  { id: "b1", label: "1–10", min: 1, max: 10 },
  { id: "b2", label: "11–25", min: 11, max: 25 },
  { id: "b3", label: "26–50", min: 26, max: 50 },
  { id: "b4", label: "51–100", min: 51, max: 100 },
  { id: "b5", label: "101–200", min: 101, max: 200 },
  { id: "b6", label: "201–500", min: 201, max: 500 },
  { id: "b7", label: "501–1000", min: 501, max: 1000 },
  { id: "b8", label: "1000+", min: 1001, max: null },
] as const;

/** Users with zero solved are reported separately so they never hide in "1–10". */
export const ZERO_BUCKET = { id: "b0", label: "0 (Not Started)", min: 0, max: 0 };

export const DEPARTMENTS = [
  "CSE",
  "AIDS",
  "AIML",
  "IT",
  "ECE",
  "EEE",
  "MECH",
  "CIVIL",
  "AGRI",
] as const;

export const YEARS = ["1", "2", "3", "4"] as const;
export const SECTIONS = ["A", "B", "C", "D"] as const;

export const DIFFICULTY_COLORS = {
  easy: "#00b8a3",
  medium: "#ffb800",
  hard: "#ff375f",
} as const;

/** Brand palette, mirrored in `app/globals.css` as CSS custom properties. */
export const CHART_COLORS = [
  "#c8102e",
  "#f5a800",
  "#1b3a6b",
  "#00b8a3",
  "#7c3aed",
  "#ff375f",
  "#0ea5e9",
  "#84cc16",
  "#f97316",
  "#ec4899",
] as const;

/** Days without a solve before a user is flagged inactive. */
export const INACTIVE_THRESHOLD_DAYS = 7;

export const SETTING_KEYS = {
  SYNC_HOUR_IST: "sync_hour_ist",
  SYNC_MINUTE_IST: "sync_minute_ist",
  INACTIVE_DAYS: "inactive_threshold_days",
  COLLEGE_NAME: "college_name",
  LAST_SYNC_AT: "last_sync_at",
} as const;

export const DEFAULT_SETTINGS: Record<string, string> = {
  [SETTING_KEYS.SYNC_HOUR_IST]: "19",
  [SETTING_KEYS.SYNC_MINUTE_IST]: "0",
  [SETTING_KEYS.INACTIVE_DAYS]: String(INACTIVE_THRESHOLD_DAYS),
  [SETTING_KEYS.COLLEGE_NAME]: COLLEGE_NAME,
};

/** Column headers accepted by the bulk importer (case/spacing insensitive). */
export const IMPORT_COLUMNS = {
  registerNo: ["register no", "registerno", "register number", "regno", "reg no", "roll no", "rollno"],
  name: ["name", "student name", "full name", "staff name"],
  department: ["department", "dept", "branch"],
  year: ["year", "study year", "yr"],
  section: ["section", "sec"],
  role: ["role", "type", "category"],
  leetcodeUsername: [
    "leetcode username",
    "leetcodeusername",
    "leetcode id",
    "leetcode",
    "username",
    "leetcode handle",
    "handle",
  ],
  email: ["email", "email id", "mail"],
} as const;

export const IMPORT_TEMPLATE_HEADERS = [
  "Register No",
  "Name",
  "Department",
  "Year",
  "Section",
  "Role",
  "LeetCode Username",
] as const;
