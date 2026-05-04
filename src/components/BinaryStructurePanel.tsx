"use client";

import { useMemo } from "react";
import type { BinaryField, BinaryFormatSummary } from "@/lib/binaryFormatSniffer";
import { flattenBinaryFields } from "@/lib/binaryFormatSniffer";
import type { ByteSelection } from "@/lib/hexViewerUtils";
import { formatOffset } from "@/lib/hexViewerUtils";

interface BinaryStructurePanelProps {
  summary: BinaryFormatSummary;
  selectedOffset: number | null;
  activeRange: ByteSelection | null;
  onSelectField: (field: BinaryField) => void;
}

export default function BinaryStructurePanel({
  summary,
  selectedOffset,
  activeRange,
  onSelectField,
}: BinaryStructurePanelProps) {
  const flatFields = useMemo(() => flattenBinaryFields(summary.fields), [summary.fields]);
  const containingField = useMemo(() => {
    if (selectedOffset === null) return null;
    return flatFields
      .filter((field) => field.length > 0 && selectedOffset >= field.offset && selectedOffset < field.offset + field.length)
      .sort((a, b) => a.length - b.length)[0] ?? null;
  }, [flatFields, selectedOffset]);

  return (
    <aside
      className="flex h-full w-[320px] shrink-0 flex-col border-l text-xs"
      style={{ borderColor: "var(--sh-border)", backgroundColor: "var(--sh-bg2)", color: "var(--sh-text2)" }}
    >
      <div className="border-b p-3" style={{ borderColor: "var(--sh-border)" }}>
        <div className="mb-1 flex items-center gap-2">
          <h2 className="truncate text-sm font-semibold" style={{ color: "var(--sh-text)" }}>
            {summary.label}
          </h2>
          <span
            className="rounded px-1.5 py-0.5 text-[10px] uppercase"
            style={{ backgroundColor: "var(--sh-bg-active)", color: "var(--sh-text2)" }}
          >
            {summary.confidence}
          </span>
        </div>
        <p className="leading-relaxed">{summary.description}</p>
        {summary.metadata.length > 0 && (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {summary.metadata.map((item) => (
              <div key={`${item.label}-${item.value}`} className="contents">
                <dt className="whitespace-nowrap" style={{ color: "var(--sh-text-muted)" }}>{item.label}</dt>
                <dd className="min-w-0 truncate font-mono" style={{ color: "var(--sh-text)" }}>{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="border-b p-3" style={{ borderColor: "var(--sh-border)" }}>
        <div className="mb-1 text-[11px] uppercase tracking-wide" style={{ color: "var(--sh-text-muted)" }}>
          Current byte
        </div>
        {selectedOffset === null ? (
          <p>No byte selected.</p>
        ) : (
          <div className="space-y-1">
            <p className="font-mono" style={{ color: "var(--sh-text)" }}>0x{formatOffset(selectedOffset)}</p>
            <p className="leading-relaxed">
              {containingField
                ? `Inside ${containingField.name}.`
                : "No parsed structure covers this byte."}
            </p>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-2">
        <div className="mb-2 px-1 text-[11px] uppercase tracking-wide" style={{ color: "var(--sh-text-muted)" }}>
          Parsed structure
        </div>
        {summary.fields.length === 0 ? (
          <p className="px-1 leading-relaxed">No structure fields were identified.</p>
        ) : (
          <div className="space-y-1">
            {summary.fields.map((field) => (
              <FieldButton
                key={field.id}
                field={field}
                depth={0}
                activeRange={activeRange}
                onSelectField={onSelectField}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function FieldButton({
  field,
  depth,
  activeRange,
  onSelectField,
}: {
  field: BinaryField;
  depth: number;
  activeRange: ByteSelection | null;
  onSelectField: (field: BinaryField) => void;
}) {
  const isActive = Boolean(
    activeRange &&
      field.offset === activeRange.start &&
      Math.max(field.offset, field.offset + field.length - 1) === activeRange.end
  );
  const rangeLabel = field.length === 0
    ? `0x${formatOffset(field.offset)}`
    : `0x${formatOffset(field.offset)}-0x${formatOffset(field.offset + field.length - 1)}`;

  return (
    <div>
      <button
        type="button"
        className="w-full rounded px-2 py-1.5 text-left transition-colors hover:bg-[var(--sh-bg-hover)]"
        style={{
          paddingLeft: `${8 + depth * 12}px`,
          backgroundColor: isActive ? "var(--sh-hex-range-bg)" : "transparent",
          color: "var(--sh-text)",
        }}
        onClick={() => onSelectField(field)}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate">{field.name}</span>
          <span className="shrink-0 font-mono text-[10px]" style={{ color: "var(--sh-text-muted)" }}>
            {field.length.toLocaleString()} B
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="font-mono text-[10px]" style={{ color: "var(--sh-text-muted)" }}>{rangeLabel}</span>
          {field.value && <span className="truncate font-mono text-[10px]" style={{ color: "var(--sh-accent-green)" }}>{field.value}</span>}
        </div>
        {field.description && (
          <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--sh-text2)" }}>
            {field.description}
          </p>
        )}
      </button>
      {field.children?.map((child) => (
        <FieldButton
          key={child.id}
          field={child}
          depth={depth + 1}
          activeRange={activeRange}
          onSelectField={onSelectField}
        />
      ))}
    </div>
  );
}
