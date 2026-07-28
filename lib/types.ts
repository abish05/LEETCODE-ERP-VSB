import type { Role, UserStatus } from "@prisma/client";

export interface TrackedUserDTO {
  id: string;
  registerNo: string;
  name: string;
  department: string;
  year: string | null;
  section: string | null;
  role: Role;
  leetcodeUsername: string;
  email: string | null;
  status: UserStatus;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  todaySolved: number;
  currentStreak: number;
  maxStreak: number;
  ranking: number | null;
  contestRating: number | null;
  contestsCount: number;
  totalActiveDays: number;
  acceptanceRate: number | null;
  avatarUrl: string | null;
  lastSyncedAt: string | null;
  syncError: string | null;
}

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface DashboardStats {
  totals: {
    users: number;
    students: number;
    staff: number;
    activeToday: number;
    solvedToday: number;
    highestStreak: number;
    inactiveUsers: number;
    invalidProfiles: number;
    problemsSolved: number;
  };
  averages: {
    total: number;
    easy: number;
    medium: number;
    hard: number;
    streak: number;
  };
  difficulty: { easy: number; medium: number; hard: number };
  growth: { weekly: number; monthly: number; weeklySolved: number; monthlySolved: number };
  topPerformer: TopUser | null;
  mostActiveToday: TopUser | null;
  longestStreak: TopUser | null;
  trend: Array<{ date: string; solved: number; activeUsers: number; cumulative: number }>;
  departments: Array<{ department: string; users: number; total: number; average: number }>;
  lastSync: {
    at: string | null;
    status: string | null;
    succeeded: number;
    failed: number;
    durationMs: number;
  } | null;
}

export interface TopUser {
  id: string;
  name: string;
  registerNo: string;
  department: string;
  leetcodeUsername: string;
  avatarUrl: string | null;
  value: number;
}

export interface SplitBucketDTO {
  id: string;
  label: string;
  min: number;
  max: number | null;
  count: number;
  percentage: number;
}

export interface DepartmentAnalyticsDTO {
  department: string;
  users: number;
  students: number;
  staff: number;
  totalSolved: number;
  averageSolved: number;
  averageStreak: number;
  easy: number;
  medium: number;
  hard: number;
  activeToday: number;
  inactive: number;
  solvedThisWeek: number;
  topPerformer: { name: string; registerNo: string; totalSolved: number } | null;
  mostActive: { name: string; registerNo: string; todaySolved: number } | null;
  leastActive: { name: string; registerNo: string; totalSolved: number } | null;
}

export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  user: { id: string; name: string; registerNo: string } | null;
}

export interface UserHistoryDTO {
  user: TrackedUserDTO;
  snapshots: Array<{
    date: string;
    totalSolved: number;
    easySolved: number;
    mediumSolved: number;
    hardSolved: number;
    todaySolved: number;
    currentStreak: number;
    ranking: number | null;
    contestRating: number | null;
  }>;
  periods: { today: number; week: number; month: number; year: number };
  rank: { overall: number | null; department: number | null; outOf: number };
}

export interface ImportSummary {
  fileName: string;
  totalRows: number;
  created: number;
  updated: number;
  duplicates: number;
  invalid: number;
  issues: Array<{
    rowNumber: number;
    registerNo: string;
    leetcodeUsername: string;
    reason: string;
    kind: "invalid" | "duplicate";
  }>;
  missingColumns: string[];
}

export interface SyncStatusDTO {
  running: boolean;
  last: {
    id: string;
    startedAt: string;
    finishedAt: string | null;
    status: string;
    totalUsers: number;
    succeeded: number;
    failed: number;
    durationMs: number;
    triggeredBy: string;
    message: string | null;
  } | null;
  history: Array<{
    id: string;
    startedAt: string;
    status: string;
    succeeded: number;
    failed: number;
    durationMs: number;
    triggeredBy: string;
  }>;
}
