export const BYTES_PER_ROW = 16;
export const ROW_HEIGHT = 24;
export const VISIBLE_BUFFER = 10;

export interface VisibleRowRange {
  startRow: number;
  endRow: number;
}

export interface ByteSelection {
  start: number;
  end: number;
}

export interface ByteInspectorValue {
  offsetHex: string;
  offsetDecimal: string;
  hex: string;
  decimal: string;
  ascii: string;
  uint16LE: string;
  uint16BE: string;
  uint32LE: string;
  uint32BE: string;
}

export function byteToHex(byte: number): string {
  return byte.toString(16).padStart(2, "0").toUpperCase();
}

export function byteToAscii(byte: number): string {
  return byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".";
}

export function formatOffset(offset: number, width = 8): string {
  return offset.toString(16).toUpperCase().padStart(width, "0");
}

export function calculateVisibleRowRange(
  totalRows: number,
  scrollTop: number,
  containerHeight: number,
  rowHeight = ROW_HEIGHT,
  buffer = VISIBLE_BUFFER
): VisibleRowRange {
  const visibleRows = Math.ceil(containerHeight / rowHeight) + buffer * 2;
  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
  return {
    startRow,
    endRow: Math.min(totalRows, startRow + visibleRows),
  };
}

export function clampOffset(offset: number, byteLength: number): number {
  if (byteLength <= 0) return 0;
  return Math.min(byteLength - 1, Math.max(0, offset));
}

export function normalizeSelection(anchor: number | null, focus: number | null): ByteSelection | null {
  if (anchor === null || focus === null) return null;
  return {
    start: Math.min(anchor, focus),
    end: Math.max(anchor, focus),
  };
}

export function isOffsetInSelection(offset: number, selection: ByteSelection | null): boolean {
  return Boolean(selection && offset >= selection.start && offset <= selection.end);
}

export function parseOffsetInput(input: string, byteLength: number): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const normalized = trimmed.toLowerCase();
  const parsed = normalized.startsWith("0x")
    ? Number.parseInt(normalized.slice(2), 16)
    : /[a-f]/i.test(normalized)
      ? Number.parseInt(normalized, 16)
      : Number.parseInt(normalized, 10);

  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 0 || parsed >= byteLength) {
    return null;
  }

  return parsed;
}

export function parseHexByteSequence(input: string): Uint8Array | null {
  const stripped = input.replace(/0x/gi, "").replace(/[^0-9a-fA-F]/g, "");
  if (!stripped || stripped.length % 2 !== 0) return null;

  const bytes = new Uint8Array(stripped.length / 2);
  for (let i = 0; i < stripped.length; i += 2) {
    const value = Number.parseInt(stripped.slice(i, i + 2), 16);
    if (Number.isNaN(value)) return null;
    bytes[i / 2] = value;
  }
  return bytes;
}

export function encodeAsciiSearch(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

export function findBytePattern(
  bytes: Uint8Array,
  pattern: Uint8Array,
  startOffset = 0,
  direction: "forward" | "backward" = "forward"
): number {
  if (pattern.length === 0 || pattern.length > bytes.length) return -1;

  if (direction === "backward") {
    const start = Math.min(bytes.length - pattern.length, Math.max(0, startOffset));
    for (let i = start; i >= 0; i--) {
      if (matchesAt(bytes, pattern, i)) return i;
    }
    for (let i = bytes.length - pattern.length; i > start; i--) {
      if (matchesAt(bytes, pattern, i)) return i;
    }
    return -1;
  }

  const start = Math.min(Math.max(0, startOffset), bytes.length - pattern.length);
  for (let i = start; i <= bytes.length - pattern.length; i++) {
    if (matchesAt(bytes, pattern, i)) return i;
  }
  for (let i = 0; i < start; i++) {
    if (matchesAt(bytes, pattern, i)) return i;
  }
  return -1;
}

function matchesAt(bytes: Uint8Array, pattern: Uint8Array, offset: number): boolean {
  for (let i = 0; i < pattern.length; i++) {
    if (bytes[offset + i] !== pattern[i]) return false;
  }
  return true;
}

export function replaceByteRange(
  bytes: Uint8Array,
  replacement: Uint8Array,
  selection: ByteSelection | null,
  cursorOffset: number
): Uint8Array {
  const start = selection?.start ?? cursorOffset;
  const endExclusive = selection ? selection.end + 1 : cursorOffset + replacement.length;
  const result = new Uint8Array(bytes);
  const writableLength = Math.min(
    replacement.length,
    Math.max(0, endExclusive - start),
    Math.max(0, bytes.length - start)
  );
  result.set(replacement.slice(0, writableLength), start);
  return result;
}

export function copySelectionAsHex(bytes: Uint8Array, selection: ByteSelection): string {
  return Array.from(bytes.slice(selection.start, selection.end + 1), byteToHex).join(" ");
}

export function copySelectionAsAscii(bytes: Uint8Array, selection: ByteSelection): string {
  return Array.from(bytes.slice(selection.start, selection.end + 1), byteToAscii).join("");
}

export function getByteInspectorValue(bytes: Uint8Array, offset: number | null): ByteInspectorValue | null {
  if (offset === null || offset < 0 || offset >= bytes.length) return null;

  const byte = bytes[offset];
  return {
    offsetHex: `0x${formatOffset(offset)}`,
    offsetDecimal: offset.toLocaleString(),
    hex: `0x${byteToHex(byte)}`,
    decimal: byte.toString(10),
    ascii: byteToAscii(byte),
    uint16LE: readUnsigned(bytes, offset, 2, true),
    uint16BE: readUnsigned(bytes, offset, 2, false),
    uint32LE: readUnsigned(bytes, offset, 4, true),
    uint32BE: readUnsigned(bytes, offset, 4, false),
  };
}

function readUnsigned(bytes: Uint8Array, offset: number, width: 2 | 4, littleEndian: boolean): string {
  if (offset + width > bytes.length) return "-";

  let value = 0;
  for (let i = 0; i < width; i++) {
    const shift = littleEndian ? i * 8 : (width - 1 - i) * 8;
    value += bytes[offset + i] * 2 ** shift;
  }
  return value.toString(10);
}
