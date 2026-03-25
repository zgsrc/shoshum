"use client";

import { useMemo } from "react";
import { computeDiff, getDiffStats, type DiffLine } from "@/lib/diff";

interface DiffViewProps {
  original: string;
  modified: string;
  fileName: string;
  onClose: () => void;
}

export default function DiffView({ original, modified, fileName, onClose }: DiffViewProps) {
  const lines = useMemo(() => computeDiff(original, modified), [original, modified]);
  const stats = useMemo(() => getDiffStats(lines), [lines]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: "var(--sh-bg)" }}
    >
      <div
        className="flex items-center h-10 px-4 gap-3 shrink-0"
        style={{ backgroundColor: "var(--sh-bg2)", borderBottom: "1px solid var(--sh-border)" }}
      >
        <span className="text-sm font-medium font-mono" style={{ color: "var(--sh-text)" }}>
          {fileName}
        </span>
        <span className="text-xs" style={{ color: "var(--sh-text-muted)" }}>
          — diff
        </span>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs font-mono" style={{ color: "#3fb950" }}>
            +{stats.added}
          </span>
          <span className="text-xs font-mono" style={{ color: "#f85149" }}>
            -{stats.removed}
          </span>
          <span className="text-xs font-mono" style={{ color: "var(--sh-text-muted)" }}>
            ~{stats.same}
          </span>
          <button
            className="ml-3 p-1.5 rounded transition-colors"
            style={{ color: "var(--sh-text-muted)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--sh-text)";
              e.currentTarget.style.backgroundColor = "var(--sh-bg-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--sh-text-muted)";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            onClick={onClose}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto font-mono text-[13px]">
        {lines.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm" style={{ color: "var(--sh-text-muted)" }}>
              No differences
            </span>
          </div>
        )}
        {stats.added === 0 && stats.removed === 0 && lines.length > 0 && (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm" style={{ color: "var(--sh-text-muted)" }}>
              Files are identical
            </span>
          </div>
        )}
        {(stats.added > 0 || stats.removed > 0) &&
          lines.map((line, i) => <DiffRow key={i} line={line} />)}
      </div>
    </div>
  );
}

function DiffRow({ line }: { line: DiffLine }) {
  const bgColor =
    line.type === "added"
      ? "rgba(63, 185, 80, 0.1)"
      : line.type === "removed"
        ? "rgba(248, 81, 73, 0.1)"
        : "transparent";

  const textColor =
    line.type === "added"
      ? "#3fb950"
      : line.type === "removed"
        ? "#f85149"
        : "var(--sh-text)";

  const prefix = line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";

  return (
    <div
      className="flex"
      style={{ backgroundColor: bgColor, minHeight: "22px" }}
    >
      <span
        className="w-12 shrink-0 text-right pr-2 select-none"
        style={{ color: "var(--sh-text-muted)", opacity: 0.6 }}
      >
        {line.oldLineNum ?? ""}
      </span>
      <span
        className="w-12 shrink-0 text-right pr-2 select-none"
        style={{ color: "var(--sh-text-muted)", opacity: 0.6 }}
      >
        {line.newLineNum ?? ""}
      </span>
      <span
        className="w-5 shrink-0 text-center select-none font-bold"
        style={{ color: textColor }}
      >
        {prefix}
      </span>
      <span className="flex-1 whitespace-pre pr-4" style={{ color: textColor }}>
        {line.content}
      </span>
    </div>
  );
}
