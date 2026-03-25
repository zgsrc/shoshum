import type { Row } from "read-excel-file/browser";

export interface WorkbookPreview {
  sheets: string[];
  tables: Record<string, string[][]>;
}

export interface ParsedWorkbookSheet {
  name?: string | null;
  rows: Row[];
}

export const MAX_SPREADSHEET_PREVIEW_BYTES = 12 * 1024 * 1024;

export function getSpreadsheetPreviewUnsupportedReason(
  name: string
): string | null {
  const normalizedName = name.trim().toLowerCase();

  if (normalizedName.endsWith(".xls")) {
    return "Legacy Excel workbooks (.xls) are not supported by the hardened browser preview yet. Switch to Binary view to inspect the file.";
  }

  if (normalizedName.endsWith(".xlsb")) {
    return "Binary Excel workbooks (.xlsb) are not supported by the hardened browser preview yet. Switch to Binary view to inspect the file.";
  }

  if (normalizedName.endsWith(".ods")) {
    return "OpenDocument spreadsheets (.ods) are not supported by the hardened browser preview yet. Switch to Binary view to inspect the file.";
  }

  return null;
}

export function buildWorkbookPreview(
  worksheets: ParsedWorkbookSheet[]
): WorkbookPreview {
  const tables: Record<string, string[][]> = {};
  const sheets: string[] = [];
  const usedNames = new Set<string>();

  worksheets.forEach((worksheet, index) => {
    const sheetName = getUniqueWorksheetName(worksheet, index, usedNames);
    sheets.push(sheetName);
    tables[sheetName] = normalizeWorksheetData(worksheet.rows);
    usedNames.add(sheetName);
  });

  return { sheets, tables };
}

function normalizeWorksheetData(rows: Row[]): string[][] {
  return rows.map((row) => Array.from(row, (value) => formatCellValue(value)));
}

function formatCellValue(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function getUniqueWorksheetName(
  worksheet: ParsedWorkbookSheet,
  index: number,
  usedNames: Set<string>
): string {
  const baseName =
    typeof worksheet.name === "string" &&
    worksheet.name.trim().length > 0
      ? worksheet.name.trim()
      : `Sheet ${index + 1}`;

  if (!usedNames.has(baseName)) {
    return baseName;
  }

  let suffix = 2;
  let candidate = `${baseName} (${suffix})`;
  while (usedNames.has(candidate)) {
    suffix += 1;
    candidate = `${baseName} (${suffix})`;
  }

  return candidate;
}
