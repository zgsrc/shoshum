"use client";

import { useEffect, useMemo, useState } from "react";
import PreviewMessage from "./PreviewMessage";

interface SpreadsheetViewerProps {
  bytes: Uint8Array;
  name: string;
}

interface WorkbookPreview {
  sheets: string[];
  tables: Record<string, string[][]>;
}

const MAX_ROWS = 250;
const MAX_COLUMNS = 60;

export default function SpreadsheetViewer({ bytes, name }: SpreadsheetViewerProps) {
  const [preview, setPreview] = useState<WorkbookPreview | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    const loadWorkbook = async () => {
      try {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(bytes.slice().buffer as ArrayBuffer, { type: "array" });
        const tables: Record<string, string[][]> = {};

        for (const sheetName of workbook.SheetNames as string[]) {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            raw: false,
            blankrows: false,
          }) as unknown[][];
          tables[sheetName] = rows.map((row) =>
            row.map((value) => (value == null ? "" : String(value)))
          );
        }

        if (!disposed) {
          const nextPreview = {
            sheets: workbook.SheetNames as string[],
            tables,
          };
          setPreview(nextPreview);
          setSelectedSheet(nextPreview.sheets[0] ?? null);
          setError(null);
        }
      } catch (reason) {
        if (!disposed) {
          setError(reason instanceof Error ? reason.message : "Could not parse this spreadsheet.");
        }
      }
    };

    setPreview(null);
    setSelectedSheet(null);
    setError(null);
    void loadWorkbook();

    return () => {
      disposed = true;
    };
  }, [bytes]);

  const rows = useMemo(() => {
    if (!preview || !selectedSheet) return [];
    return preview.tables[selectedSheet] ?? [];
  }, [preview, selectedSheet]);

  if (error) {
    return <PreviewMessage title="Spreadsheet preview unavailable" body={error} />;
  }

  if (!preview) {
    return (
      <PreviewMessage
        title="Preparing spreadsheet preview"
        body="Parsing workbook sheets and building a tabular preview."
      />
    );
  }

  if (preview.sheets.length === 0) {
    return (
      <PreviewMessage
        title="Spreadsheet preview unavailable"
        body="This workbook does not contain any sheets."
      />
    );
  }

  const visibleRows = rows.slice(0, MAX_ROWS).map((row) => row.slice(0, MAX_COLUMNS));
  const columnCount = visibleRows.reduce((max, row) => Math.max(max, row.length), 0);
  const headers = visibleRows[0] ?? [];

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--sh-bg)" }}>
      <div
        className="flex h-10 items-center gap-3 px-3 text-xs font-mono"
        style={{
          backgroundColor: "var(--sh-bg2)",
          borderBottom: "1px solid var(--sh-border)",
          color: "var(--sh-text2)",
        }}
      >
        <span className="truncate" title={name}>
          {name}
        </span>
        <span>{preview.sheets.length.toLocaleString()} sheets</span>
        <span>{visibleRows.length.toLocaleString()} rows</span>
        <span className="ml-auto">{selectedSheet}</span>
      </div>
      <div className="flex h-11 items-center gap-2 overflow-auto border-b px-3" style={{ borderColor: "var(--sh-border)", backgroundColor: "var(--sh-bg2)" }}>
        {preview.sheets.map((sheetName) => (
          <button
            key={sheetName}
            type="button"
            onClick={() => setSelectedSheet(sheetName)}
            className="rounded-md px-3 py-1.5 text-xs font-mono transition-colors"
            style={{
              backgroundColor: selectedSheet === sheetName ? "var(--sh-bg-active)" : "transparent",
              border: "1px solid var(--sh-border)",
              color: selectedSheet === sheetName ? "var(--sh-text)" : "var(--sh-text2)",
            }}
          >
            {sheetName}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {(rows.length > MAX_ROWS || columnCount > MAX_COLUMNS) && (
          <div
            className="mb-3 rounded-lg px-3 py-2 text-xs font-mono"
            style={{
              backgroundColor: "var(--sh-bg2)",
              border: "1px solid var(--sh-border)",
              color: "var(--sh-text2)",
            }}
          >
            Showing the first {MAX_ROWS} rows and {MAX_COLUMNS} columns.
          </div>
        )}
        <div
          className="overflow-auto rounded-xl"
          style={{
            border: "1px solid var(--sh-border)",
            backgroundColor: "var(--sh-bg2)",
          }}
        >
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr>
                {Array.from({ length: columnCount }).map((_, columnIndex) => (
                  <th
                    key={`column-${columnIndex}`}
                    className="sticky top-0 px-3 py-2 text-left font-mono text-xs"
                    style={{
                      backgroundColor: "var(--sh-bg-active)",
                      borderBottom: "1px solid var(--sh-border)",
                      borderRight: "1px solid var(--sh-border)",
                      color: "var(--sh-text)",
                    }}
                  >
                    {headers[columnIndex] || `Column ${columnIndex + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.slice(1).map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {Array.from({ length: columnCount }).map((_, columnIndex) => (
                    <td
                      key={`${rowIndex}-${columnIndex}`}
                      className="max-w-[22rem] px-3 py-2 align-top"
                      style={{
                        borderBottom: "1px solid var(--sh-border)",
                        borderRight: "1px solid var(--sh-border)",
                        color: "var(--sh-text)",
                      }}
                    >
                      <span className="break-words whitespace-pre-wrap">
                        {row[columnIndex] ?? ""}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
