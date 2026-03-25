"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";

interface HexViewerProps {
  bytes: Uint8Array;
  readOnly?: boolean;
  onChange?: (bytes: Uint8Array) => void;
}

const BYTES_PER_ROW = 16;
const ROW_HEIGHT = 24;
const VISIBLE_BUFFER = 10;

function byteToHex(byte: number): string {
  return byte.toString(16).padStart(2, "0");
}

function byteToAscii(byte: number): string {
  return byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : "·";
}

export default function HexViewer({ bytes, readOnly = false, onChange }: HexViewerProps) {
  const [editingOffset, setEditingOffset] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalRows = Math.ceil(bytes.length / BYTES_PER_ROW);
  const visibleRows = Math.ceil(containerHeight / ROW_HEIGHT) + VISIBLE_BUFFER * 2;
  const startRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VISIBLE_BUFFER);
  const endRow = Math.min(totalRows, startRow + visibleRows);

  const rows = useMemo(() => {
    const result: { offset: number; hexCells: { value: string; byteIdx: number }[]; ascii: string }[] = [];
    for (let row = startRow; row < endRow; row++) {
      const offset = row * BYTES_PER_ROW;
      const hexCells: { value: string; byteIdx: number }[] = [];
      let ascii = "";
      for (let col = 0; col < BYTES_PER_ROW; col++) {
        const idx = offset + col;
        if (idx < bytes.length) {
          hexCells.push({ value: byteToHex(bytes[idx]), byteIdx: idx });
          ascii += byteToAscii(bytes[idx]);
        } else {
          hexCells.push({ value: "  ", byteIdx: -1 });
          ascii += " ";
        }
      }
      result.push({ offset, hexCells, ascii });
    }
    return result;
  }, [bytes, startRow, endRow]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const handleCellClick = useCallback(
    (byteIdx: number) => {
      if (readOnly || byteIdx === -1) return;
      setEditingOffset(byteIdx);
      setEditValue(byteToHex(bytes[byteIdx]));
    },
    [readOnly, bytes]
  );

  const commitEdit = useCallback(() => {
    if (editingOffset === null) return;
    const parsed = parseInt(editValue, 16);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 255) {
      const newBytes = new Uint8Array(bytes);
      newBytes[editingOffset] = parsed;
      onChange?.(newBytes);
    }
    setEditingOffset(null);
    setEditValue("");
  }, [editingOffset, editValue, bytes, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        commitEdit();
      } else if (e.key === "Escape") {
        setEditingOffset(null);
        setEditValue("");
      } else if (e.key === "Tab" && editingOffset !== null) {
        e.preventDefault();
        commitEdit();
        const next = e.shiftKey
          ? Math.max(0, editingOffset - 1)
          : Math.min(bytes.length - 1, editingOffset + 1);
        setEditingOffset(next);
        setEditValue(byteToHex(bytes[next]));
      }
    },
    [commitEdit, editingOffset, bytes]
  );

  useEffect(() => {
    if (editingOffset !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingOffset]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const rafId = requestAnimationFrame(() => {
      if (element.clientHeight > 0) {
        setContainerHeight(element.clientHeight);
      }
    });

    if (typeof ResizeObserver === "undefined") {
      return () => cancelAnimationFrame(rafId);
    }

    const observer = new ResizeObserver((entries) => {
      const nextHeight = entries[0]?.contentRect.height ?? element.clientHeight;
      if (nextHeight > 0) {
        setContainerHeight(nextHeight);
      }
    });

    observer.observe(element);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-auto font-mono text-[13px] leading-none"
      style={{ backgroundColor: "var(--sh-bg)" }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalRows * ROW_HEIGHT, position: "relative" }}>
        <div style={{ position: "absolute", top: startRow * ROW_HEIGHT, left: 0, right: 0 }}>
          {rows.map((row) => (
            <div
              key={row.offset}
              className="flex items-center"
              style={{ height: ROW_HEIGHT }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--sh-bg2)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <span
                className="w-[80px] shrink-0 px-3 text-right select-none"
                style={{ color: "var(--sh-text-muted)" }}
              >
                {row.offset.toString(16).padStart(8, "0")}
              </span>
              <span className="px-2" style={{ borderLeft: "1px solid var(--sh-border)" }} />
              <div className="flex gap-[2px] shrink-0">
                {row.hexCells.map((cell, i) => (
                  <span key={i} className="relative">
                    {editingOffset === cell.byteIdx ? (
                      <input
                        ref={inputRef}
                        className="w-[22px] text-white text-center font-mono text-[13px] outline-none rounded-sm"
                        style={{ backgroundColor: "var(--sh-hex-edit-bg)" }}
                        value={editValue}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 2);
                          setEditValue(v);
                        }}
                        onBlur={commitEdit}
                        onKeyDown={handleKeyDown}
                        maxLength={2}
                      />
                    ) : (
                      <span
                        className={`inline-block w-[22px] text-center rounded-sm ${
                          cell.byteIdx === -1 ? "text-transparent cursor-default" :
                          !readOnly ? "cursor-pointer" : "cursor-default"
                        }`}
                        style={{
                          color: cell.byteIdx === -1
                            ? "transparent"
                            : bytes[cell.byteIdx] === 0
                              ? "var(--sh-hex-zero)"
                              : "var(--sh-hex-byte)",
                        }}
                        onMouseEnter={(e) => {
                          if (cell.byteIdx !== -1) e.currentTarget.style.backgroundColor = "var(--sh-bg-active)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                        onClick={() => handleCellClick(cell.byteIdx)}
                      >
                        {cell.value}
                      </span>
                    )}
                    {i === 7 && <span className="inline-block w-[6px]" />}
                  </span>
                ))}
              </div>
              <span className="px-2" style={{ borderLeft: "1px solid var(--sh-border)" }} />
              <span
                className="tracking-[1px] select-none whitespace-pre"
                style={{ color: "var(--sh-hex-ascii)" }}
              >
                {row.ascii}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
