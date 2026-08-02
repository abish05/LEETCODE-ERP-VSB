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
  const rawMatrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (rawMatrix.length === 0) {
    return {
      fileName,
      totalRows: 0,
      valid: [],
      issues: [],
      missingColumns: ["The first sheet has no data rows."],
      detectedColumns: {},
    };
  }

  // ── Search up to the first 25 rows for the true header row ──────────────
  let headerRowIdx = 0;
  let maxMatchedCount = -1;
  let bestHeaderMap = new Map<string, { colIndex: number; headerName: string }>();
  const detectedColumns: Record<string, string> = {};

  // We match highly specific fields first before generic words like "name" or "role".
  const priorityFields: (keyof typeof IMPORT_COLUMNS)[] = [
    "leetcodeUsername",
    "registerNo",
    "email",
    "department",
    "year",
    "section",
    "role",
    "name",
  ];

  const searchLimit = Math.min(25, rawMatrix.length);
  for (let r = 0; r < searchLimit; r++) {
    const row = rawMatrix[r] || [];
    if (!Array.isArray(row) || row.length === 0) continue;

    const usedIndices = new Set<number>();
    const candidateMap = new Map<
      string,
      { colIndex: number; headerName: string }
    >();

    for (const field of priorityFields) {
      const aliases = IMPORT_COLUMNS[field];

      // 1) Try exact match
      let matchIndex = row.findIndex((cellVal, idx) => {
        if (usedIndices.has(idx)) return false;
        return (aliases as readonly string[]).includes(
          normalizeHeader(String(cellVal)),
        );
      });

      // 2) Try startsWith match (e.g. "name of the student (initial at the last)")
      if (matchIndex === -1) {
        matchIndex = row.findIndex((cellVal, idx) => {
          if (usedIndices.has(idx)) return false;
          const norm = normalizeHeader(String(cellVal));
          if (!norm) return false;
          return aliases.some((alias) => norm.startsWith(alias));
        });
      }

      // 3) Try substring/word inclusion match (e.g. "student leetcode id url")
      if (matchIndex === -1) {
        matchIndex = row.findIndex((cellVal, idx) => {
          if (usedIndices.has(idx)) return false;
          const norm = ` ${normalizeHeader(String(cellVal))} `;
          if (norm.trim() === "") return false;
          return aliases.some((alias) => norm.includes(` ${alias} `));
        });
      }

      if (matchIndex !== -1) {
        usedIndices.add(matchIndex);
        candidateMap.set(field, {
          colIndex: matchIndex,
          headerName: String(row[matchIndex] || field).trim(),
        });
      }
    }

    // Prefer the row that matches the greatest number of target columns.
    if (candidateMap.size > maxMatchedCount) {
      maxMatchedCount = candidateMap.size;
      headerRowIdx = r;
      bestHeaderMap = candidateMap;
    }
  }

  for (const [field, meta] of bestHeaderMap.entries()) {
    detectedColumns[field] = meta.headerName;
  }

  const required: (keyof typeof IMPORT_COLUMNS)[] = [
    "registerNo",
    "name",
    "department",
    "leetcodeUsername",
  ];
  const missingColumns = required
    .filter((field) => !bestHeaderMap.has(field))
    .map((field) => {
      const label = IMPORT_TEMPLATE_HEADERS.find(
        (h) => normalizeHeader(h) === IMPORT_COLUMNS[field][0],
      );
      return label ?? field;
    });

  const totalDataRows = Math.max(0, rawMatrix.length - (headerRowIdx + 1));

  if (missingColumns.length > 0) {
    return {
      fileName,
      totalRows: totalDataRows,
      valid: [],
      issues: [],
      missingColumns,
      detectedColumns,
    };
  }

  const get = (row: unknown[], field: keyof typeof IMPORT_COLUMNS): string => {
    const meta = bestHeaderMap.get(field);
    return meta ? cell(row[meta.colIndex]) : "";
  };

  const valid: ParsedRow[] = [];
  const issues: RowIssue[] = [];

  const seenRegisterNos = new Set<string>();
  const seenUsernames = new Set<string>();

  for (let r = headerRowIdx + 1; r < rawMatrix.length; r++) {
    const row = rawMatrix[r];
    if (!Array.isArray(row)) continue;

    const rowNumber = r + 1; // 1-based line number in Excel

    const registerNo = get(row, "registerNo").toUpperCase();
    const name = get(row, "name");
    const department = normalizeDepartment(get(row, "department"));
    const rawUsername = get(row, "leetcodeUsername");
    const leetcodeUsername = sanitizeUsername(rawUsername);

    // Skip fully blank rows — trailing empties are extremely common in Excel.
    if (!registerNo && !name && !rawUsername && !department) continue;

    const reject = (reason: string, kind: RowIssue["kind"] = "invalid") => {
      issues.push({
        rowNumber,
        registerNo,
        leetcodeUsername: rawUsername,
        reason,
        kind,
      });
    };

    if (!registerNo) {
      reject("Register number is empty");
      continue;
    }
    if (!name) {
      reject("Name is empty");
      continue;
    }
    if (!department) {
      reject("Department is empty");
      continue;
    }
    if (!rawUsername) {
      reject("LeetCode username is empty");
      continue;
    }
    if (!isValidUsername(leetcodeUsername)) {
      reject(
        `"${rawUsername}" is not a valid LeetCode username (letters, digits, . _ - only)`,
      );
      continue;
    }

    if (seenRegisterNos.has(registerNo)) {
      reject(
        `Register number ${registerNo} appears more than once in this file`,
        "duplicate",
      );
      continue;
    }
    const usernameKey = leetcodeUsername.toLowerCase();
    if (seenUsernames.has(usernameKey)) {
      reject(
        `LeetCode username "${leetcodeUsername}" appears more than once in this file`,
        "duplicate",
      );
      continue;
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
  }

  return {
    fileName,
    totalRows: totalDataRows,
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
