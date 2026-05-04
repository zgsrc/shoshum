"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { ByteSelection } from "@/lib/hexViewerUtils";
import {
  BYTES_PER_ROW,
  ROW_HEIGHT,
  calculateVisibleRowRange,
  byteToAscii,
  byteToHex,
  clampOffset,
  copySelectionAsAscii,
  copySelectionAsHex,
  encodeAsciiSearch,
  findBytePattern,
  formatOffset,
  getByteInspectorValue,
  isOffsetInSelection,
  normalizeSelection,
  parseHexByteSequence,
  parseOffsetInput,
  replaceByteRange,
  VISIBLE_BUFFER,
} from "@/lib/hexViewerUtils";

interface HexViewerProps {
  bytes: Uint8Array;
  readOnly?: boolean;
  onChange?: (bytes: Uint8Array) => void;
  activeRange?: ByteSelection | null;
  onSelectedOffsetChange?: (offset: number | null) => void;
  onSelectionChange?: (selection: ByteSelection | null) => void;
}

type SearchMode = "hex" | "ascii";

export default function HexViewer({
  bytes,
  readOnly = false,
  onChange,
  activeRange = null,
  onSelectedOffsetChange,
  onSelectionChange,
}: HexViewerProps) {
  const [editingOffset, setEditingOffset] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const [cursorOffset, setCursorOffset] = useState<number | null>(bytes.length > 0 ? 0 : null);
  const [selectionAnchor, setSelectionAnchor] = useState<number | null>(bytes.length > 0 ? 0 : null);
  const [selectionFocus, setSelectionFocus] = useState<number | null>(bytes.length > 0 ? 0 : null);
  const [searchMode, setSearchMode] = useState<SearchMode>("hex");
  const [searchInput, setSearchInput] = useState("");
  const [jumpInput, setJumpInput] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalRows = Math.ceil(bytes.length / BYTES_PER_ROW);
  const { startRow, endRow } = calculateVisibleRowRange(
    totalRows,
    scrollTop,
    containerHeight,
    ROW_HEIGHT,
    VISIBLE_BUFFER
  );
  const safeCursorOffset =
    cursorOffset === null || bytes.length === 0 ? null : clampOffset(cursorOffset, bytes.length);
  const selection = useMemo(
    () => {
      if (bytes.length === 0 || selectionAnchor === null || selectionFocus === null) return null;
      return normalizeSelection(
        clampOffset(selectionAnchor, bytes.length),
        clampOffset(selectionFocus, bytes.length)
      );
    },
    [bytes.length, selectionAnchor, selectionFocus]
  );
  const inspector = useMemo(
    () => getByteInspectorValue(bytes, safeCursorOffset),
    [bytes, safeCursorOffset]
  );
  const searchPattern = useMemo(() => {
    if (!searchInput.trim()) return null;
    return searchMode === "hex"
      ? parseHexByteSequence(searchInput)
      : encodeAsciiSearch(searchInput);
  }, [searchInput, searchMode]);

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

  const scrollToOffset = useCallback((offset: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const row = Math.floor(offset / BYTES_PER_ROW);
    const rowTop = row * ROW_HEIGHT;
    const rowBottom = rowTop + ROW_HEIGHT;
    const viewportTop = scroller.scrollTop;
    const viewportBottom = viewportTop + scroller.clientHeight;

    if (rowTop < viewportTop) {
      scroller.scrollTop = rowTop;
    } else if (rowBottom > viewportBottom) {
      scroller.scrollTop = Math.max(0, rowBottom - scroller.clientHeight);
    }
  }, []);

  const moveCursor = useCallback(
    (nextOffset: number, extendSelection = false) => {
      if (bytes.length === 0) return;
      const next = clampOffset(nextOffset, bytes.length);
      setCursorOffset(next);
      setSelectionAnchor((currentAnchor) => (extendSelection ? currentAnchor ?? cursorOffset ?? next : next));
      setSelectionFocus(next);
      onSelectedOffsetChange?.(next);
      scrollToOffset(next);
    },
    [bytes.length, cursorOffset, onSelectedOffsetChange, scrollToOffset]
  );

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const beginEdit = useCallback(
    (byteIdx: number) => {
      if (readOnly || byteIdx < 0 || byteIdx >= bytes.length) return;
      setEditingOffset(byteIdx);
      setEditValue(byteToHex(bytes[byteIdx]));
    },
    [readOnly, bytes]
  );

  const handleCellClick = useCallback(
    (byteIdx: number, extendSelection: boolean) => {
      if (byteIdx === -1) return;
      moveCursor(byteIdx, extendSelection);
      if (!extendSelection) {
        setSelectionAnchor(byteIdx);
        setSelectionFocus(byteIdx);
      }
    },
    [moveCursor]
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

  const cancelEdit = useCallback(() => {
    setEditingOffset(null);
    setEditValue("");
  }, []);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        commitEdit();
      } else if (e.key === "Escape") {
        cancelEdit();
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
    [cancelEdit, commitEdit, editingOffset, bytes]
  );

  const runSearch = useCallback(
    (direction: "forward" | "backward" = "forward") => {
      if (!searchPattern) {
        setStatusMessage("Enter a valid search pattern first.");
        return;
      }
      const origin = safeCursorOffset ?? 0;
      const start = direction === "forward" ? origin + 1 : origin - 1;
      const match = findBytePattern(bytes, searchPattern, start, direction);
      if (match === -1) {
        setStatusMessage("No match found.");
        return;
      }

      setStatusMessage(`Match at 0x${formatOffset(match)}.`);
      setCursorOffset(match);
      setSelectionAnchor(match);
      setSelectionFocus(match + searchPattern.length - 1);
      onSelectedOffsetChange?.(match);
      scrollToOffset(match);
    },
    [bytes, onSelectedOffsetChange, safeCursorOffset, scrollToOffset, searchPattern]
  );

  const jumpToOffset = useCallback(() => {
    const offset = parseOffsetInput(jumpInput, bytes.length);
    if (offset === null) {
      setStatusMessage("Enter an offset within this file.");
      return;
    }
    setStatusMessage(`Jumped to 0x${formatOffset(offset)}.`);
    moveCursor(offset, false);
  }, [bytes.length, jumpInput, moveCursor]);

  const copySelection = useCallback(
    async (mode: "hex" | "ascii") => {
      if (!selection || typeof navigator === "undefined" || !navigator.clipboard) return;
      const text = mode === "hex"
        ? copySelectionAsHex(bytes, selection)
        : copySelectionAsAscii(bytes, selection);
      try {
        await navigator.clipboard.writeText(text);
        setStatusMessage(`Copied ${mode === "hex" ? "hex" : "ASCII"} selection.`);
      } catch {
        setStatusMessage("Clipboard write failed.");
      }
    },
    [bytes, selection]
  );

  const pasteHexAtSelection = useCallback(
    async (explicitText?: string) => {
      if (readOnly || safeCursorOffset === null) return;
      let text = explicitText ?? "";
      if (!explicitText && typeof navigator !== "undefined" && navigator.clipboard) {
        try {
          text = await navigator.clipboard.readText();
        } catch {
          setStatusMessage("Clipboard read failed.");
          return;
        }
      }
      const replacement = parseHexByteSequence(text);
      if (!replacement) {
        setStatusMessage("Clipboard does not contain an even-length hex byte sequence.");
        return;
      }

      const nextBytes = replaceByteRange(bytes, replacement, selection, safeCursorOffset);
      onChange?.(nextBytes);
      const nextFocus = clampOffset(safeCursorOffset + replacement.length - 1, bytes.length);
      setCursorOffset(nextFocus);
      setSelectionAnchor(safeCursorOffset);
      setSelectionFocus(nextFocus);
      setStatusMessage(`Pasted ${replacement.length.toLocaleString()} byte${replacement.length === 1 ? "" : "s"}.`);
    },
    [bytes, onChange, readOnly, safeCursorOffset, selection]
  );

  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (editingOffset !== null || safeCursorOffset === null) return;
      const mod = e.metaKey || e.ctrlKey;
      const pageRows = Math.max(1, Math.floor(containerHeight / ROW_HEIGHT) - 1);
      let nextOffset: number | null = null;

      if (e.key === "ArrowRight") nextOffset = safeCursorOffset + 1;
      else if (e.key === "ArrowLeft") nextOffset = safeCursorOffset - 1;
      else if (e.key === "ArrowDown") nextOffset = safeCursorOffset + BYTES_PER_ROW;
      else if (e.key === "ArrowUp") nextOffset = safeCursorOffset - BYTES_PER_ROW;
      else if (e.key === "PageDown") nextOffset = safeCursorOffset + pageRows * BYTES_PER_ROW;
      else if (e.key === "PageUp") nextOffset = safeCursorOffset - pageRows * BYTES_PER_ROW;
      else if (e.key === "Home") nextOffset = mod ? 0 : Math.floor(safeCursorOffset / BYTES_PER_ROW) * BYTES_PER_ROW;
      else if (e.key === "End") nextOffset = mod ? bytes.length - 1 : Math.min(bytes.length - 1, Math.floor(safeCursorOffset / BYTES_PER_ROW) * BYTES_PER_ROW + BYTES_PER_ROW - 1);
      else if (e.key === "Enter") {
        e.preventDefault();
        beginEdit(safeCursorOffset);
        return;
      } else if (e.key === "Escape") {
        e.preventDefault();
        setSelectionAnchor(safeCursorOffset);
        setSelectionFocus(safeCursorOffset);
        setStatusMessage("");
        return;
      } else if (mod && e.key.toLowerCase() === "f") {
        e.preventDefault();
        document.getElementById("hex-search-input")?.focus();
        return;
      } else if (mod && e.key.toLowerCase() === "c") {
        e.preventDefault();
        void copySelection(e.shiftKey ? "ascii" : "hex");
        return;
      } else if (mod && e.key.toLowerCase() === "v") {
        e.preventDefault();
        void pasteHexAtSelection();
        return;
      }

      if (nextOffset !== null) {
        e.preventDefault();
        moveCursor(nextOffset, e.shiftKey);
      }
    },
    [beginEdit, bytes.length, containerHeight, copySelection, editingOffset, moveCursor, pasteHexAtSelection, safeCursorOffset]
  );

  useEffect(() => {
    if (editingOffset !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingOffset]);

  useEffect(() => {
    onSelectionChange?.(selection);
  }, [onSelectionChange, selection]);

  useEffect(() => {
    if (!activeRange) return;

    const frame = requestAnimationFrame(() => {
      setCursorOffset(activeRange.start);
      setSelectionAnchor(activeRange.start);
      setSelectionFocus(activeRange.end);
      onSelectedOffsetChange?.(activeRange.start);
      scrollToOffset(activeRange.start);
    });

    return () => cancelAnimationFrame(frame);
  }, [activeRange, onSelectedOffsetChange, scrollToOffset]);

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
      className="flex h-full w-full flex-col font-mono text-[13px]"
      style={{ backgroundColor: "var(--sh-bg)" }}
    >
      <div
        className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-[11px]"
        style={{ borderColor: "var(--sh-border)", color: "var(--sh-text2)", backgroundColor: "var(--sh-bg2)" }}
      >
        <label className="flex items-center gap-1">
          <span>Search</span>
          <select
            className="rounded px-1 py-0.5 outline-none"
            style={{ backgroundColor: "var(--sh-bg)", color: "var(--sh-text)" }}
            value={searchMode}
            onChange={(e) => setSearchMode(e.target.value as SearchMode)}
          >
            <option value="hex">hex</option>
            <option value="ascii">ASCII</option>
          </select>
        </label>
        <input
          id="hex-search-input"
          className="w-40 rounded px-2 py-1 font-mono outline-none"
          style={{ backgroundColor: "var(--sh-bg)", color: "var(--sh-text)", border: "1px solid var(--sh-border)" }}
          placeholder={searchMode === "hex" ? "89 50 4E 47" : "SQLite"}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") runSearch(e.shiftKey ? "backward" : "forward");
          }}
        />
        <button className="rounded px-2 py-1" style={{ backgroundColor: "var(--sh-bg-active)", color: "var(--sh-text)" }} onClick={() => runSearch("backward")}>Prev</button>
        <button className="rounded px-2 py-1" style={{ backgroundColor: "var(--sh-bg-active)", color: "var(--sh-text)" }} onClick={() => runSearch("forward")}>Next</button>
        <span className="mx-1 h-4 border-l" style={{ borderColor: "var(--sh-border)" }} />
        <input
          className="w-28 rounded px-2 py-1 font-mono outline-none"
          style={{ backgroundColor: "var(--sh-bg)", color: "var(--sh-text)", border: "1px solid var(--sh-border)" }}
          placeholder="offset"
          value={jumpInput}
          onChange={(e) => setJumpInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") jumpToOffset();
          }}
        />
        <button className="rounded px-2 py-1" style={{ backgroundColor: "var(--sh-bg-active)", color: "var(--sh-text)" }} onClick={jumpToOffset}>Go</button>
        <span className="mx-1 h-4 border-l" style={{ borderColor: "var(--sh-border)" }} />
        <button className="rounded px-2 py-1" style={{ backgroundColor: "var(--sh-bg-active)", color: "var(--sh-text)" }} onClick={() => void copySelection("hex")}>Copy Hex</button>
        <button className="rounded px-2 py-1" style={{ backgroundColor: "var(--sh-bg-active)", color: "var(--sh-text)" }} onClick={() => void copySelection("ascii")}>Copy ASCII</button>
        {!readOnly && (
          <button className="rounded px-2 py-1" style={{ backgroundColor: "var(--sh-bg-active)", color: "var(--sh-text)" }} onClick={() => void pasteHexAtSelection()}>Paste Hex</button>
        )}
        {statusMessage && <span className="ml-auto truncate">{statusMessage}</span>}
      </div>

      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-auto leading-none outline-none"
        tabIndex={0}
        role="grid"
        aria-label="Binary hex editor"
        aria-readonly={readOnly}
        onKeyDown={handleGridKeyDown}
        onScroll={handleScroll}
      >
        <div style={{ height: totalRows * ROW_HEIGHT, position: "relative" }}>
          <div style={{ position: "absolute", top: startRow * ROW_HEIGHT, left: 0, right: 0 }}>
            {rows.map((row) => (
              <div
                key={row.offset}
                className="flex items-center hover:bg-[var(--sh-bg2)]"
                role="row"
                style={{ height: ROW_HEIGHT }}
              >
                <span
                  className="w-[80px] shrink-0 px-3 text-right select-none"
                  style={{ color: "var(--sh-text-muted)" }}
                >
                  {formatOffset(row.offset)}
                </span>
                <span className="px-2" style={{ borderLeft: "1px solid var(--sh-border)" }} />
                <div className="flex gap-[2px] shrink-0" role="presentation">
                  {row.hexCells.map((cell, i) => {
                    const isRealByte = cell.byteIdx !== -1;
                    const isSelected = isRealByte && isOffsetInSelection(cell.byteIdx, selection);
                    const isActive = isRealByte && cell.byteIdx === safeCursorOffset;
                    const isStructure = isRealByte && isOffsetInSelection(cell.byteIdx, activeRange);
                    const cellBackground = isSelected
                      ? "var(--sh-hex-selection-bg)"
                      : isStructure
                        ? "var(--sh-hex-range-bg)"
                        : "transparent";
                    return (
                      <span key={i} className="relative">
                        {editingOffset === cell.byteIdx ? (
                          <input
                            ref={inputRef}
                            aria-label={`Edit byte at offset 0x${formatOffset(cell.byteIdx)}`}
                            className="w-[22px] text-center font-mono text-[13px] outline-none rounded-sm"
                            style={{ backgroundColor: "var(--sh-hex-edit-bg)", color: "var(--sh-hex-edit-text)" }}
                            value={editValue}
                            onChange={(e) => {
                              const v = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 2);
                              setEditValue(v);
                            }}
                            onBlur={commitEdit}
                            onKeyDown={handleInputKeyDown}
                            maxLength={2}
                          />
                        ) : (
                          <button
                            type="button"
                            role="gridcell"
                            tabIndex={-1}
                            aria-selected={isSelected}
                            aria-label={isRealByte ? `Offset 0x${formatOffset(cell.byteIdx)}, byte ${cell.value}` : "No byte"}
                            disabled={!isRealByte}
                            className={`inline-block w-[22px] rounded-sm text-center outline-none transition-colors ${
                              isRealByte ? "cursor-pointer hover:bg-[var(--sh-bg-active)]" : "cursor-default text-transparent"
                            } ${isActive ? "ring-1 ring-[var(--sh-hex-cursor-ring)]" : ""}`}
                            style={{
                              backgroundColor: cellBackground,
                              color: !isRealByte
                                ? "transparent"
                                : bytes[cell.byteIdx] === 0
                                  ? "var(--sh-hex-zero)"
                                  : "var(--sh-hex-byte)",
                            }}
                            onClick={(e) => handleCellClick(cell.byteIdx, e.shiftKey)}
                            onDoubleClick={() => beginEdit(cell.byteIdx)}
                          >
                            {cell.value}
                          </button>
                        )}
                        {i === 7 && <span className="inline-block w-[6px]" />}
                      </span>
                    );
                  })}
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

      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-3 py-2 text-[11px]"
        style={{ borderColor: "var(--sh-border)", color: "var(--sh-text2)", backgroundColor: "var(--sh-bg2)" }}
      >
        {inspector ? (
          <>
            <span>Offset <strong style={{ color: "var(--sh-text)" }}>{inspector.offsetHex}</strong></span>
            <span>Dec {inspector.decimal}</span>
            <span>Hex {inspector.hex}</span>
            <span>ASCII {inspector.ascii}</span>
            <span>u16 LE {inspector.uint16LE}</span>
            <span>u16 BE {inspector.uint16BE}</span>
            <span>u32 LE {inspector.uint32LE}</span>
            <span>u32 BE {inspector.uint32BE}</span>
          </>
        ) : (
          <span>No bytes loaded.</span>
        )}
      </div>
    </div>
  );
}
