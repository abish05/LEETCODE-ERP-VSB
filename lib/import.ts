import * as XLSX from "xlsx";
import type { Role } from "@prisma/client";

import { IMPORT_COLUMNS, IMPORT_TEMPLATE_HEADERS } from "./constants";
import { isValidUsername, sanitizeUsername } from "./leetcode";
import { normalizeDepartment } from "./utils";

export interface ParsedRow {
  rowNumber: number;
  registerNo: string;
  name: string;
  department: string;
  year: string | null;
  section: string | null;
  role: Role;
  leetcodeUsername: string;
  email: string | null;
}

export interface RowIssue {
  rowNumber: number;
  registerNo: string;
  leetcodeUsername: string;
  reason: string;
  kind: "invalid" | "duplicate";
}

export interface ParseResult {
  fileName: string;
  totalRows: number;
  valid: ParsedRow[];
  issues: RowIssue[];
  missingColumns: string[];
  detectedColumns: Record<string, string>;
}

/** "Register No." / "register_no" / " REGISTER NO " all collapse to "register no". */
function normalizeHeader(header: string): string {
  return String(header)
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function parseRole(value: string): Role {
  const v = value.toLowerCase();
  if (v.startsWith("staff") || v.startsWith("faculty") || v.startsWith("prof")) {
    return "STAFF";
  }
  return "STUDENT";
}

/** Accepts "4", "IV", "4th year", "Year 4"; returns null for staff placeholders. */
function parseYear(value: string): string | null {
  const raw = value.trim();
  if (!raw || raw === "-" || raw === "—" || raw.toLowerCase() === "na") {
    return null;
  }
  const roman: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4" };
  const lower = raw.toLowerCase().replace(/\s|year|yr|st|nd|rd|th/g, "");
  if (roman[lower]) return roman[lower];
  const digits = raw.match(/[1-5]/);
  return digits ? digits[0] : null;
}

function parseSection(value: string): string | null {
  const raw = value.trim();
  if (!raw || raw === "-" || raw === "—" || raw.toLowerCase() === "na") {
    return null;
  }
  return raw.toUpperCase().slice(0, 4);
}

/**
 * Parses an XLSX / XLS / CSV buffer into validated rows.
 *
 * Header matching is fuzzy (see IMPORT_COLUMNS) because real college
 * spreadsheets are never formatted the way a template asks them to be.
 */
export function parseSpreadsheet(
  buffer: ArrayBuffer | Buffer,
  fileName: string,
): ParseResult {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    raw: false,
  });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      fileName,
      totalRows: 0,
      valid: [],
      issues: [],
      missingColumns: ["The workbook contains no sheets."],
      detectedColumns: {},
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (rows.length === 0) {
    return {
      fileName,
      totalRows: 0,
      valid: [],
      issues: [],
      missingColumns: ["The first sheet has no data rows."],
      detectedColumns: {},
    };
  }

  // ── Map spreadsheet headers onto our field names ──────────────────────
  const headers = Object.keys(rows[0]);
  const headerMap = new Map<string, string>(); // field -> actual header
  const detectedColumns: Record<string, string> = {};

  for (const [field, aliases] of Object.entries(IMPORT_COLUMNS)) {
    const match = headers.find((header) =>
      (aliases as readonly string[]).includes(normalizeHeader(header)),
    );
    if (match) {
      headerMap.set(field, match);
      detectedColumns[field] = match;
    }
  }

  const required = ["registerNo", "name", "department", "leetcodeUsername"];
  const missingColumns = required
    .filter((field) => !headerMap.has(field))
    .map((field) => {
      const label = IMPORT_TEMPLATE_HEADERS.find(
        (h) => normalizeHeader(h) === (IMPORT_COLUMNS as never)[field][0],
      );
      return label ?? field;
    });

  if (missingColumns.length > 0) {
    return {
      fileName,
      totalRows: rows.length,
      valid: [],
      issues: [],
      missingColumns,
      detectedColumns,
    };
  }

  const get = (row: Record<string, unknown>, field: string): string => {
    const header = headerMap.get(field);
    return header ? cell(row[header]) : "";
  };

  const valid: ParsedRow[] = [];
  const issues: RowIssue[] = [];

  const seenRegisterNos = new Set<string>();
  const seenUsernames = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // +1 for header, +1 for 1-based rows

    const registerNo = get(row, "registerNo").toUpperCase();
    const name = get(row, "name");
    const department = normalizeDepartment(get(row, "department"));
    const rawUsername = get(row, "leetcodeUsername");
    const leetcodeUsername = sanitizeUsername(rawUsername);

    // Skip fully blank rows — trailing empties are extremely common in Excel.
    if (!registerNo && !name && !rawUsername) return;

    const reject = (reason: string, kind: RowIssue["kind"] = "invalid") => {
      issues.push({ rowNumber, registerNo, leetcodeUsername: rawUsername, reason, kind });
    };

    if (!registerNo) return reject("Register number is empty");
    if (!name) return reject("Name is empty");
    if (!department) return reject("Department is empty");
    if (!rawUsername) return reject("LeetCode username is empty");
    if (!isValidUsername(leetcodeUsername)) {
      return reject(
        `"${rawUsername}" is not a valid LeetCode username (letters, digits, . _ - only)`,
      );
    }

    if (seenRegisterNos.has(registerNo)) {
      return reject(
        `Register number ${registerNo} appears more than once in this file`,
        "duplicate",
      );
    }
    const usernameKey = leetcodeUsername.toLowerCase();
    if (seenUsernames.has(usernameKey)) {
      return reject(
        `LeetCode username "${leetcodeUsername}" appears more than once in this file`,
        "duplicate",
      );
    }

    seenRegisterNos.add(registerNo);
    seenUsernames.add(usernameKey);

    const role = parseRole(get(row, "role"));

    valid.push({
      rowNumber,
      registerNo,
      name,
      department,
      year: role === "STAFF" ? null : parseYear(get(row, "year")),
      section: role === "STAFF" ? null : parseSection(get(row, "section")),
      role,
      leetcodeUsername,
      email: get(row, "email") || null,
    });
  });

  return {
    fileName,
    totalRows: rows.length,
    valid,
    issues,
    missingColumns: [],
    detectedColumns,
  };
}

/** Builds the downloadable starter template with a few example rows. */
export function buildTemplateWorkbook(): Buffer {
  const sample = [
    {
      "Register No": "23CS001",
      Name: "Abish A",
      Department: "CSE",
      Year: "4",
      Section: "A",
      Role: "Student",
      "LeetCode Username": "abish05",
    },
    {
      "Register No": "23CS002",
      Name: "Arun K",
      Department: "CSE",
      Year: "4",
      Section: "A",
      Role: "Student",
      "LeetCode Username": "arun123",
    },
    {
      "Register No": "23EC010",
      Name: "Priya S",
      Department: "ECE",
      Year: "3",
      Section: "B",
      Role: "Student",
      "LeetCode Username": "priya_codes",
    },
    {
      "Register No": "STA001",
      Name: "Dr. Kumar",
      Department: "CSE",
      Year: "-",
      Section: "-",
      Role: "Staff",
      "LeetCode Username": "drkumar",
    },
  ];

  const sheet = XLSX.utils.json_to_sheet(sample, {
    header: [...IMPORT_TEMPLATE_HEADERS],
  });
  sheet["!cols"] = [
    { wch: 14 },
    { wch: 24 },
    { wch: 14 },
    { wch: 8 },
    { wch: 10 },
    { wch: 10 },
    { wch: 22 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Users");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** Serialises arbitrary report rows to an .xlsx buffer (used by every export). */
export function buildWorkbook(
  rows: Record<string, unknown>[],
  sheetName = "Report",
): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows);

  if (rows.length > 0) {
    sheet["!cols"] = Object.keys(rows[0]).map((key) => ({
      wch: Math.min(
        40,
        Math.max(
          key.length + 2,
          ...rows.slice(0, 200).map((row) => String(row[key] ?? "").length + 2),
        ),
      ),
    }));
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31));
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
