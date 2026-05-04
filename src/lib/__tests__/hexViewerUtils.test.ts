import { describe, expect, it } from "vitest";
import {
  byteToAscii,
  byteToHex,
  calculateVisibleRowRange,
  copySelectionAsAscii,
  copySelectionAsHex,
  findBytePattern,
  getByteInspectorValue,
  normalizeSelection,
  parseHexByteSequence,
  parseOffsetInput,
  replaceByteRange,
} from "../hexViewerUtils";
import { decodeBinaryAsset, getBinaryAssetFixture } from "./binaryAssetFixtures";

describe("hex viewer formatting", () => {
  it("formats bytes and printable ASCII", () => {
    expect(byteToHex(0)).toBe("00");
    expect(byteToHex(255)).toBe("FF");
    expect(byteToAscii(0x41)).toBe("A");
    expect(byteToAscii(0)).toBe(".");
  });

  it("calculates a buffered visible row range", () => {
    expect(calculateVisibleRowRange(100, 240, 240, 24, 2)).toEqual({
      startRow: 8,
      endRow: 22,
    });
  });
});

describe("hex input parsing", () => {
  it("parses decimal, prefixed hex, and bare hex offsets", () => {
    expect(parseOffsetInput("10", 32)).toBe(10);
    expect(parseOffsetInput("0x10", 32)).toBe(16);
    expect(parseOffsetInput("1f", 64)).toBe(31);
  });

  it("rejects offsets outside the byte range", () => {
    expect(parseOffsetInput("100", 16)).toBeNull();
    expect(parseOffsetInput("-1", 16)).toBeNull();
  });

  it("parses hex byte sequences with common separators", () => {
    expect(Array.from(parseHexByteSequence("89 50 4e 47") ?? [])).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(Array.from(parseHexByteSequence("0x48, 0x69") ?? [])).toEqual([0x48, 0x69]);
    expect(Array.from(parseHexByteSequence("0X4F") ?? [])).toEqual([0x4f]);
  });

  it("rejects incomplete hex byte sequences", () => {
    expect(parseHexByteSequence("abc")).toBeNull();
  });
});

describe("selection and searching", () => {
  const bytes = new Uint8Array([0x41, 0x42, 0x43, 0x41, 0x42, 0x44]);

  it("normalizes selection direction", () => {
    expect(normalizeSelection(4, 1)).toEqual({ start: 1, end: 4 });
  });

  it("finds byte patterns forward, backward, and with wraparound", () => {
    expect(findBytePattern(bytes, new Uint8Array([0x41, 0x42]), 1, "forward")).toBe(3);
    expect(findBytePattern(bytes, new Uint8Array([0x41, 0x42]), 2, "backward")).toBe(0);
    expect(findBytePattern(bytes, new Uint8Array([0x41, 0x42]), 5, "forward")).toBe(0);
  });

  it("copies selections as hex or ASCII", () => {
    const selection = { start: 0, end: 2 };
    expect(copySelectionAsHex(bytes, selection)).toBe("41 42 43");
    expect(copySelectionAsAscii(bytes, selection)).toBe("ABC");
  });

  it("replaces a byte range without resizing the file", () => {
    const replaced = replaceByteRange(bytes, new Uint8Array([0x78, 0x79]), { start: 1, end: 2 }, 1);
    expect(Array.from(replaced)).toEqual([0x41, 0x78, 0x79, 0x41, 0x42, 0x44]);
  });

  it("truncates replacements that would extend past the file", () => {
    const replaced = replaceByteRange(bytes, new Uint8Array([0x78, 0x79, 0x7a]), null, 5);
    expect(Array.from(replaced)).toEqual([0x41, 0x42, 0x43, 0x41, 0x42, 0x78]);
  });
});

describe("fixture-backed hex workflows", () => {
  it("finds a PNG chunk name inside a real PNG asset", () => {
    const fixture = getBinaryAssetFixture("png-1x1");
    const bytes = decodeBinaryAsset(fixture.base64);
    const pattern = new TextEncoder().encode("IHDR");

    expect(findBytePattern(bytes, pattern)).toBe(12);
  });

  it("copies a real GIF header as ASCII and hex", () => {
    const fixture = getBinaryAssetFixture("gif-1x1");
    const bytes = decodeBinaryAsset(fixture.base64);
    const selection = { start: 0, end: 5 };

    expect(copySelectionAsAscii(bytes, selection)).toBe("GIF89a");
    expect(copySelectionAsHex(bytes, selection)).toBe("47 49 46 38 39 61");
  });

  it("patches bytes in a real SQLite fixture without resizing it", () => {
    const fixture = getBinaryAssetFixture("sqlite-header");
    const bytes = decodeBinaryAsset(fixture.base64);
    const replaced = replaceByteRange(bytes, new Uint8Array([0x20, 0x00]), { start: 16, end: 17 }, 16);

    expect(replaced.length).toBe(bytes.length);
    expect(replaced[16]).toBe(0x20);
    expect(replaced[17]).toBe(0x00);
    expect(copySelectionAsAscii(replaced, { start: 0, end: 15 })).toBe("SQLite format 3.");
  });
});

describe("byte inspector", () => {
  it("shows scalar values for the selected offset", () => {
    const inspected = getByteInspectorValue(new Uint8Array([0x01, 0x02, 0x03, 0x04]), 0);
    expect(inspected).toMatchObject({
      offsetHex: "0x00000000",
      hex: "0x01",
      decimal: "1",
      uint16LE: "513",
      uint16BE: "258",
      uint32LE: "67305985",
      uint32BE: "16909060",
    });
  });
});
