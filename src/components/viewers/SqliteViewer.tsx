"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SqlJsDatabase } from "sql.js";
import PreviewMessage from "./PreviewMessage";

interface SqliteViewerProps {
  bytes: Uint8Array;
  name: string;
}

interface TableInfo {
  name: string;
  type: string;
  sql: string | null;
}

interface QueryResult {
  columns: string[];
  rows: string[][];
  rowCount: number | null;
}

const MAX_ROWS = 200;
const SQLITE_WASM_URL = new URL(
  "../../../node_modules/sql.js/dist/sql-wasm-browser.wasm",
  import.meta.url
).toString();

export default function SqliteViewer({ bytes, name }: SqliteViewerProps) {
  const databaseRef = useRef<SqlJsDatabase | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingLabel, setLoadingLabel] = useState<string | null>("Opening SQLite database...");

  useEffect(() => {
    let disposed = false;

    const openDatabase = async () => {
      try {
        const { default: initSqlJs } = await import("sql.js");
        const SQL = await initSqlJs({
          locateFile: () => SQLITE_WASM_URL,
        });
        if (disposed) return;

        const database = new SQL.Database(bytes.slice());
        databaseRef.current = database;

        const result = database.exec(`
          SELECT name, type, sql
          FROM sqlite_master
          WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
          ORDER BY type, name
        `);

        const items = result[0]?.values.map(([tableName, type, sql]) => ({
          name: String(tableName),
          type: String(type),
          sql: typeof sql === "string" ? sql : null,
        })) ?? [];

        if (disposed) {
          database.close();
          return;
        }

        setTables(items);
        setSelectedTable(items[0]?.name ?? null);
        setLoadingLabel(null);
      } catch (reason) {
        if (!disposed) {
          setError(reason instanceof Error ? reason.message : "Could not open this SQLite file.");
          setLoadingLabel(null);
        }
      }
    };

    databaseRef.current?.close();
    databaseRef.current = null;
    setTables([]);
    setSelectedTable(null);
    setQueryResult(null);
    setError(null);
    setLoadingLabel("Opening SQLite database...");

    void openDatabase();

    return () => {
      disposed = true;
      databaseRef.current?.close();
      databaseRef.current = null;
    };
  }, [bytes]);

  useEffect(() => {
    const database = databaseRef.current;
    if (!database || !selectedTable) {
      setQueryResult(null);
      return;
    }

    try {
      const safeName = quoteIdentifier(selectedTable);
      const countResult = database.exec(`SELECT COUNT(*) AS count FROM ${safeName}`);
      const rowCountValue = countResult[0]?.values[0]?.[0];
      const rowCount = typeof rowCountValue === "number" ? rowCountValue : Number(rowCountValue);

      const previewResult = database.exec(`SELECT * FROM ${safeName} LIMIT ${MAX_ROWS}`);
      const preview = previewResult[0];

      setQueryResult({
        columns: (preview?.columns ?? []).map(String),
        rows: (preview?.values ?? []).map((row) => row.map(formatSqlValue)),
        rowCount: Number.isFinite(rowCount) ? rowCount : null,
      });
    } catch (reason) {
      setQueryResult(null);
      setError(reason instanceof Error ? reason.message : "Could not read the selected table.");
    }
  }, [selectedTable]);

  const selectedTableInfo = useMemo(
    () => tables.find((table) => table.name === selectedTable) ?? null,
    [tables, selectedTable]
  );

  if (error) {
    return <PreviewMessage title="SQLite preview unavailable" body={error} />;
  }

  if (loadingLabel) {
    return <PreviewMessage title="Preparing SQLite preview" body={loadingLabel} />;
  }

  if (tables.length === 0) {
    return (
      <PreviewMessage
        title="SQLite preview unavailable"
        body="This database does not contain any tables or views that can be previewed."
      />
    );
  }

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
        <span>{tables.length.toLocaleString()} table{tables.length === 1 ? "" : "s"}/views</span>
        {queryResult?.rowCount != null && <span>{queryResult.rowCount.toLocaleString()} rows</span>}
        <span className="ml-auto">SQLite</span>
      </div>
      <div className="flex min-h-0 flex-1">
        <aside
          className="w-72 shrink-0 overflow-auto border-r p-3"
          style={{
            borderColor: "var(--sh-border)",
            backgroundColor: "var(--sh-bg2)",
          }}
        >
          <div className="mb-3 text-xs font-mono uppercase tracking-wide" style={{ color: "var(--sh-text2)" }}>
            Schema
          </div>
          <div className="flex flex-col gap-2">
            {tables.map((table) => (
              <button
                key={table.name}
                type="button"
                onClick={() => setSelectedTable(table.name)}
                className="rounded-lg px-3 py-2 text-left transition-colors"
                style={{
                  backgroundColor: selectedTable === table.name ? "var(--sh-bg-active)" : "var(--sh-bg)",
                  border: "1px solid var(--sh-border)",
                  color: selectedTable === table.name ? "var(--sh-text)" : "var(--sh-text2)",
                }}
              >
                <div className="text-sm font-medium">{table.name}</div>
                <div className="mt-1 text-[11px] font-mono uppercase">{table.type}</div>
              </button>
            ))}
          </div>
        </aside>
        <main className="min-h-0 flex-1 overflow-auto p-4">
          {selectedTableInfo && (
            <div className="mb-4 rounded-xl p-4" style={{ backgroundColor: "var(--sh-bg2)", border: "1px solid var(--sh-border)" }}>
              <div className="mb-2 text-sm font-medium" style={{ color: "var(--sh-text)" }}>
                {selectedTableInfo.name}
              </div>
              {selectedTableInfo.sql && (
                <pre
                  className="overflow-auto rounded-lg p-3 text-xs"
                  style={{
                    margin: 0,
                    backgroundColor: "var(--sh-bg)",
                    border: "1px solid var(--sh-border)",
                    color: "var(--sh-text)",
                    fontFamily: "var(--font-geist-mono), 'SF Mono', monospace",
                  }}
                >
                  {selectedTableInfo.sql}
                </pre>
              )}
            </div>
          )}

          {queryResult ? (
            <div className="overflow-auto rounded-xl" style={{ border: "1px solid var(--sh-border)", backgroundColor: "var(--sh-bg2)" }}>
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {queryResult.columns.map((column) => (
                      <th
                        key={column}
                        className="sticky top-0 px-3 py-2 text-left font-mono text-xs"
                        style={{
                          backgroundColor: "var(--sh-bg-active)",
                          borderBottom: "1px solid var(--sh-border)",
                          borderRight: "1px solid var(--sh-border)",
                          color: "var(--sh-text)",
                        }}
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queryResult.rows.map((row, rowIndex) => (
                    <tr key={`row-${rowIndex}`}>
                      {queryResult.columns.map((column, columnIndex) => (
                        <td
                          key={`${column}-${rowIndex}`}
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
          ) : (
            <PreviewMessage
              title="No rows available"
              body="The selected table or view does not expose previewable rows."
            />
          )}
        </main>
      </div>
    </div>
  );
}

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function formatSqlValue(value: unknown): string {
  if (value == null) return "null";
  if (value instanceof Uint8Array) return `[blob ${value.byteLength} bytes]`;
  if (value instanceof ArrayBuffer) return `[blob ${value.byteLength} bytes]`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
