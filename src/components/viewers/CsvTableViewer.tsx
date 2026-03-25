"use client";

import { useMemo } from "react";
import PreviewMessage from "./PreviewMessage";

interface CsvTableViewerProps {
  content: string;
  name: string;
}

const MAX_ROWS = 300;
const MAX_COLUMNS = 60;

export default function CsvTableViewer({ content, name }: CsvTableViewerProps) {
  const parsed = useMemo(() => {
    try {
      const delimiter = detectDelimiter(content);
      const rows = parseDelimitedText(content, delimiter);
      return { rows, delimiter, error: null as string | null };
    } catch (error) {
      return {
        rows: [] as string[][],
        delimiter: ",",
        error: error instanceof Error ? error.message : "Could not parse this table.",
      };
    }
  }, [content]);

  if (parsed.error) {
    return <PreviewMessage title="Table preview unavailable" body={parsed.error} />;
  }

  if (parsed.rows.length === 0) {
    return (
      <PreviewMessage
        title="Table preview unavailable"
        body="This file does not contain any rows to display."
      />
    );
  }

  const visibleRows = parsed.rows.slice(0, MAX_ROWS).map((row) => row.slice(0, MAX_COLUMNS));
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
        <span>{visibleRows.length.toLocaleString()} rows</span>
        <span>{columnCount.toLocaleString()} cols</span>
        <span className="ml-auto">{parsed.delimiter === "\t" ? "TSV" : parsed.delimiter === ";" ? "Semicolon" : "CSV"}</span>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {(parsed.rows.length > MAX_ROWS || columnCount > MAX_COLUMNS) && (
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
                <th
                  className="sticky left-0 top-0 z-20 px-3 py-2 text-right font-mono text-xs"
                  style={{
                    backgroundColor: "var(--sh-bg-active)",
                    borderRight: "1px solid var(--sh-border)",
                    borderBottom: "1px solid var(--sh-border)",
                    color: "var(--sh-text2)",
                  }}
                >
                  #
                </th>
                {Array.from({ length: columnCount }).map((_, columnIndex) => (
                  <th
                    key={`head-${columnIndex}`}
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
              {visibleRows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  <td
                    className="sticky left-0 px-3 py-2 text-right font-mono text-xs"
                    style={{
                      backgroundColor: "var(--sh-bg2)",
                      borderRight: "1px solid var(--sh-border)",
                      borderBottom: "1px solid var(--sh-border)",
                      color: "var(--sh-text2)",
                    }}
                  >
                    {rowIndex + 1}
                  </td>
                  {Array.from({ length: columnCount }).map((_, columnIndex) => (
                    <td
                      key={`cell-${rowIndex}-${columnIndex}`}
                      className="max-w-[24rem] px-3 py-2 align-top"
                      style={{
                        borderRight: "1px solid var(--sh-border)",
                        borderBottom: "1px solid var(--sh-border)",
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

function detectDelimiter(content: string): "," | "\t" | ";" {
  const sample = content.split(/\r?\n/).slice(0, 5);
  const candidates: Array<"," | "\t" | ";"> = [",", "\t", ";"];

  let best: "," | "\t" | ";" = ",";
  let bestScore = -1;

  for (const candidate of candidates) {
    const counts = sample.map((line) => countDelimiter(line, candidate));
    const score = counts.reduce((sum, count) => sum + count, 0);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function countDelimiter(line: string, delimiter: string): number {
  let count = 0;
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && char === delimiter) count += 1;
  }

  return count;
}

function parseDelimitedText(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(field);
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
