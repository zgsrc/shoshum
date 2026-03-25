"use client";

import { useMemo, useState } from "react";
import { formatBytes, type ArchiveKind } from "@/lib/fileUtils";
import {
  MAX_ARCHIVE_ENTRY_BYTES,
  type ArchiveData,
  type ArchiveEntrySummary,
} from "@/lib/archiveUtils";

interface ArchiveBrowserProps {
  archive: ArchiveData;
  archiveName: string;
  onOpenEntry: (entry: ArchiveEntrySummary) => void;
}

export default function ArchiveBrowser({
  archive,
  archiveName,
  onOpenEntry,
}: ArchiveBrowserProps) {
  const [query, setQuery] = useState("");

  const fileEntries = useMemo(
    () => archive.entries.filter((entry) => !entry.directory),
    [archive.entries]
  );
  const normalizedQuery = query.trim().toLowerCase();

  const filteredEntries = useMemo(() => {
    if (!normalizedQuery) return fileEntries;
    return fileEntries.filter((entry) =>
      entry.path.toLowerCase().includes(normalizedQuery)
    );
  }, [fileEntries, normalizedQuery]);

  return (
    <div
      className="flex h-full flex-col"
      style={{ backgroundColor: "var(--sh-bg)" }}
    >
      <div
        className="px-4 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--sh-border)" }}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2
              className="text-sm font-medium"
              style={{ color: "var(--sh-text)" }}
            >
              Archive Browser
            </h2>
            <p
              className="text-xs mt-1 leading-relaxed"
              style={{ color: "var(--sh-text2)" }}
            >
              Browse {fileEntries.length.toLocaleString()} file
              {fileEntries.length === 1 ? "" : "s"} in this{" "}
              {formatArchiveKind(archive.kind)} archive. Entries open in new
              read-only tabs.
            </p>
          </div>
          <div
            className="text-[11px] font-mono px-2 py-1 rounded shrink-0"
            style={{
              color: "var(--sh-text2)",
              backgroundColor: "var(--sh-bg2)",
              border: "1px solid var(--sh-border)",
            }}
            title={archiveName}
          >
            {archiveName}
          </div>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter archive entries..."
          className="w-full rounded-md px-3 py-2 text-sm outline-none"
          style={{
            color: "var(--sh-text)",
            backgroundColor: "var(--sh-bg2)",
            border: "1px solid var(--sh-border)",
          }}
        />
      </div>

      <div
        className="flex items-center h-8 px-4 text-[11px] font-mono shrink-0"
        style={{
          color: "var(--sh-text-muted)",
          borderBottom: "1px solid var(--sh-border)",
        }}
      >
        <span className="flex-1">Path</span>
        <span className="w-24 text-right">Size</span>
        <span className="w-28 text-right">Status</span>
      </div>

      <div className="flex-1 overflow-auto">
        {filteredEntries.length === 0 ? (
          <div
            className="flex h-full items-center justify-center px-6 text-center"
            style={{ color: "var(--sh-text2)" }}
          >
            <div>
              <p className="text-sm">No matching entries</p>
              <p className="text-xs mt-1" style={{ color: "var(--sh-text-muted)" }}>
                Try a different path fragment or clear the filter.
              </p>
            </div>
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const disabledReason = getDisabledReason(entry);
            const disabled = disabledReason !== null;

            return (
              <button
                key={entry.path}
                className="flex items-center gap-3 w-full px-4 py-2 text-left transition-colors"
                style={{
                  color: disabled ? "var(--sh-text-muted)" : "var(--sh-text)",
                  borderBottom: "1px solid var(--sh-border)",
                  cursor: disabled ? "default" : "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!disabled) {
                    e.currentTarget.style.backgroundColor = "var(--sh-bg-hover)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
                onClick={() => {
                  if (!disabled) onOpenEntry(entry);
                }}
                disabled={disabled}
                title={disabledReason ?? entry.path}
              >
                <span className="flex-1 min-w-0 font-mono text-xs truncate">
                  {entry.path}
                </span>
                <span
                  className="w-24 text-right text-xs font-mono shrink-0"
                  style={{ color: "var(--sh-text2)" }}
                >
                  {formatBytes(entry.size)}
                </span>
                <span className="w-28 text-right shrink-0">
                  <StatusBadge label={disabledReason ?? "Open"} muted={disabled} />
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function getDisabledReason(entry: ArchiveEntrySummary): string | null {
  if (entry.encrypted) return "Encrypted";
  if (entry.size > MAX_ARCHIVE_ENTRY_BYTES) {
    return `>${formatBytes(MAX_ARCHIVE_ENTRY_BYTES)}`;
  }
  return null;
}

function formatArchiveKind(kind: ArchiveKind): string {
  switch (kind) {
    case "zip":
      return "ZIP";
    case "jar":
      return "JAR";
    case "war":
      return "WAR";
    case "ear":
      return "EAR";
    case "apk":
      return "APK";
    case "tar":
      return "TAR";
    case "tgz":
      return "TAR.GZ";
    default:
      return "archive";
  }
}

function StatusBadge({
  label,
  muted,
}: {
  label: string;
  muted?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono"
      style={{
        color: muted ? "var(--sh-text-muted)" : "var(--sh-accent-blue)",
        backgroundColor: "var(--sh-bg2)",
        border: "1px solid var(--sh-border)",
      }}
    >
      {label}
    </span>
  );
}
