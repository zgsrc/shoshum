"use client";

import { useMemo } from "react";
import { XMLParser } from "fast-xml-parser";
import { parse as parseYaml } from "yaml";
import type { FileFormat } from "@/lib/fileUtils";
import PreviewMessage from "./PreviewMessage";

type StructuredFormat = Extract<FileFormat, "json" | "yaml" | "xml">;

interface StructuredDataViewerProps {
  content: string;
  format: StructuredFormat;
  name: string;
}

interface ParsedResult {
  data: unknown;
  error: string | null;
}

export default function StructuredDataViewer({
  content,
  format,
  name,
}: StructuredDataViewerProps) {
  const parsed = useMemo<ParsedResult>(() => {
    try {
      if (format === "json") {
        return { data: JSON.parse(content), error: null };
      }
      if (format === "yaml") {
        return { data: parseYaml(content), error: null };
      }

      const parser = new XMLParser({
        allowBooleanAttributes: true,
        attributeNamePrefix: "@",
        ignoreAttributes: false,
        parseTagValue: true,
        trimValues: false,
      });

      return { data: parser.parse(content), error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : `Could not parse this ${format} document.`,
      };
    }
  }, [content, format]);

  if (parsed.error) {
    return (
      <PreviewMessage
        title="Structured preview unavailable"
        body={parsed.error}
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
        <span className="ml-auto">{format.toUpperCase()} tree</span>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: "var(--sh-bg2)",
            border: "1px solid var(--sh-border)",
          }}
        >
          <TreeNode label="root" value={parsed.data} depth={0} />
        </div>
      </div>
    </div>
  );
}

function TreeNode({
  label,
  value,
  depth,
}: {
  label: string;
  value: unknown;
  depth: number;
}) {
  const indentStyle = { paddingLeft: `${depth * 16}px` };

  if (Array.isArray(value)) {
    return (
      <details open={depth < 2}>
        <summary
          className="cursor-pointer py-1 font-mono text-xs"
          style={{ color: "var(--sh-text)" }}
        >
          <span style={{ color: "var(--sh-accent-blue)" }}>{label}</span>{" "}
          <span style={{ color: "var(--sh-text2)" }}>[{value.length}]</span>
        </summary>
        <div style={indentStyle}>
          {value.map((entry, index) => (
            <TreeNode key={`${label}-${index}`} label={String(index)} value={entry} depth={depth + 1} />
          ))}
        </div>
      </details>
    );
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <details open={depth < 2}>
        <summary
          className="cursor-pointer py-1 font-mono text-xs"
          style={{ color: "var(--sh-text)" }}
        >
          <span style={{ color: "var(--sh-accent-blue)" }}>{label}</span>{" "}
          <span style={{ color: "var(--sh-text2)" }}>
            {entries.length === 0 ? "{}" : `{${entries.length}}`}
          </span>
        </summary>
        <div style={indentStyle}>
          {entries.map(([key, entryValue]) => (
            <TreeNode key={`${label}-${key}`} label={key} value={entryValue} depth={depth + 1} />
          ))}
        </div>
      </details>
    );
  }

  return (
    <div className="py-1 font-mono text-xs" style={{ ...indentStyle, color: "var(--sh-text)" }}>
      <span style={{ color: "var(--sh-accent-blue)" }}>{label}</span>
      <span style={{ color: "var(--sh-text2)" }}>: </span>
      <span style={{ color: value == null ? "var(--sh-text-muted)" : "var(--sh-accent-green)" }}>
        {formatPrimitive(value)}
      </span>
    </div>
  );
}

function formatPrimitive(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null) return "null";
  return String(value);
}
