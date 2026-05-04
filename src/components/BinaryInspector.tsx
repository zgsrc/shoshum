"use client";

import { useCallback, useMemo, useState } from "react";
import { sniffBinaryFormat, type BinaryField } from "@/lib/binaryFormatSniffer";
import type { ByteSelection } from "@/lib/hexViewerUtils";
import BinaryStructurePanel from "./BinaryStructurePanel";
import HexViewer from "./HexViewer";

interface BinaryInspectorProps {
  name: string;
  bytes: Uint8Array;
  readOnly?: boolean;
  onChange?: (bytes: Uint8Array) => void;
}

export default function BinaryInspector({
  name,
  bytes,
  readOnly = false,
  onChange,
}: BinaryInspectorProps) {
  const summary = useMemo(() => sniffBinaryFormat(bytes, name), [bytes, name]);
  const [selectedOffset, setSelectedOffset] = useState<number | null>(bytes.length > 0 ? 0 : null);
  const [selection, setSelection] = useState<ByteSelection | null>(bytes.length > 0 ? { start: 0, end: 0 } : null);
  const [activeRange, setActiveRange] = useState<ByteSelection | null>(null);

  const handleSelectField = useCallback((field: BinaryField) => {
    setActiveRange({
      start: field.offset,
      end: Math.max(field.offset, field.offset + field.length - 1),
    });
  }, []);

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="min-w-0 flex-1">
        <HexViewer
          bytes={bytes}
          readOnly={readOnly}
          onChange={onChange}
          activeRange={activeRange}
          onSelectedOffsetChange={setSelectedOffset}
          onSelectionChange={setSelection}
        />
      </div>
      <BinaryStructurePanel
        summary={summary}
        selectedOffset={selectedOffset}
        activeRange={selection ?? activeRange}
        onSelectField={handleSelectField}
      />
    </div>
  );
}
