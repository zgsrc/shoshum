import { describe, expect, it } from "vitest";
import {
  buildWorkbookPreview,
  getSpreadsheetPreviewUnsupportedReason,
} from "@/lib/spreadsheetUtils";

describe("spreadsheetUtils", () => {
  it("builds a stable workbook preview from parser results", () => {
    const preview = buildWorkbookPreview([
      {
        name: "Summary",
        rows: [
          ["Name", "Value"],
          ["Total", 42],
          [null, true],
        ],
      },
      {
        name: "",
        rows: [["Only row"]],
      },
      {
        name: "Summary",
        rows: [[new Date("2026-03-24T00:00:00.000Z")]],
      },
    ]);

    expect(preview.sheets).toEqual(["Summary", "Sheet 2", "Summary (2)"]);
    expect(preview.tables["Summary"]).toEqual([
      ["Name", "Value"],
      ["Total", "42"],
      ["", "true"],
    ]);
    expect(preview.tables["Sheet 2"]).toEqual([["Only row"]]);
    expect(preview.tables["Summary (2)"]).toEqual([
      ["2026-03-24T00:00:00.000Z"],
    ]);
  });

  it("flags xlsb preview as unsupported", () => {
    expect(getSpreadsheetPreviewUnsupportedReason("report.xlsb")).toMatch(
      /xlsb/i
    );
    expect(getSpreadsheetPreviewUnsupportedReason("report.xls")).toMatch(/xls/i);
    expect(getSpreadsheetPreviewUnsupportedReason("report.ods")).toMatch(/ods/i);
    expect(getSpreadsheetPreviewUnsupportedReason("report.xlsx")).toBeNull();
  });
});
