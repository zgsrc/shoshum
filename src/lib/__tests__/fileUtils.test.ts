import { describe, it, expect } from "vitest";
import {
  detectFormat,
  detectLineEnding,
  convertLineEnding,
  formatBytes,
  formatLabel,
  countLines,
  isBinaryByExtension,
  isBinaryByContent,
  isArchiveFile,
  decodeWithEncoding,
  detectBOM,
  toBlob,
} from "../fileUtils";

describe("detectFormat", () => {
  it("detects JavaScript files", () => {
    expect(detectFormat("app.js")).toBe("javascript");
    expect(detectFormat("main.jsx")).toBe("javascript");
    expect(detectFormat("config.mjs")).toBe("javascript");
  });

  it("detects TypeScript files", () => {
    expect(detectFormat("app.ts")).toBe("typescript");
    expect(detectFormat("page.tsx")).toBe("typescript");
  });

  it("detects Python files", () => {
    expect(detectFormat("script.py")).toBe("python");
  });

  it("detects JSON files", () => {
    expect(detectFormat("data.json")).toBe("json");
    expect(detectFormat("config.jsonc")).toBe("json");
  });

  it("detects archive files", () => {
    expect(detectFormat("file.zip")).toBe("archive");
    expect(detectFormat("file.tar")).toBe("archive");
    expect(detectFormat("file.tar.gz")).toBe("archive");
    expect(detectFormat("app.jar")).toBe("archive");
  });

  it("detects markdown files", () => {
    expect(detectFormat("README.md")).toBe("markdown");
    expect(detectFormat("notes.mdx")).toBe("markdown");
  });

  it("detects shell files by basename", () => {
    expect(detectFormat("Makefile")).toBe("shell");
    expect(detectFormat("Dockerfile")).toBe("docker");
  });

  it("detects dotenv files", () => {
    expect(detectFormat(".env")).toBe("dotenv");
    expect(detectFormat(".env.local")).toBe("dotenv");
  });

  it("falls back to text for unknown extensions", () => {
    expect(detectFormat("readme")).toBe("text");
    expect(detectFormat("unknown.xyz")).toBe("text");
  });

  it("is case-insensitive for extensions", () => {
    expect(detectFormat("file.JSON")).toBe("json");
    expect(detectFormat("file.PY")).toBe("python");
  });
});

describe("detectLineEnding", () => {
  it("detects LF", () => {
    expect(detectLineEnding("a\nb\nc")).toBe("LF");
  });

  it("detects CRLF", () => {
    expect(detectLineEnding("a\r\nb\r\nc")).toBe("CRLF");
  });

  it("detects CR", () => {
    expect(detectLineEnding("a\rb\rc")).toBe("CR");
  });

  it("detects mixed endings", () => {
    expect(detectLineEnding("a\nb\r\nc")).toBe("mixed");
  });

  it("defaults to LF for no line endings", () => {
    expect(detectLineEnding("hello")).toBe("LF");
  });
});

describe("convertLineEnding", () => {
  it("converts CRLF to LF", () => {
    expect(convertLineEnding("a\r\nb\r\nc", "LF")).toBe("a\nb\nc");
  });

  it("converts LF to CRLF", () => {
    expect(convertLineEnding("a\nb\nc", "CRLF")).toBe("a\r\nb\r\nc");
  });

  it("normalizes mixed endings to LF", () => {
    expect(convertLineEnding("a\r\nb\rc\nd", "LF")).toBe("a\nb\nc\nd");
  });

  it("normalizes mixed endings to CRLF", () => {
    expect(convertLineEnding("a\r\nb\rc\nd", "CRLF")).toBe("a\r\nb\r\nc\r\nd");
  });
});

describe("formatBytes", () => {
  it("formats zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1048576)).toBe("1.0 MB");
  });

  it("formats gigabytes", () => {
    expect(formatBytes(1073741824)).toBe("1.0 GB");
  });
});

describe("formatLabel", () => {
  it("returns human-readable labels", () => {
    expect(formatLabel("javascript")).toBe("JavaScript");
    expect(formatLabel("typescript")).toBe("TypeScript");
    expect(formatLabel("python")).toBe("Python");
    expect(formatLabel("json")).toBe("JSON");
    expect(formatLabel("text")).toBe("Plain Text");
    expect(formatLabel("binary")).toBe("Binary");
  });
});

describe("countLines", () => {
  it("returns 0 for empty string", () => {
    expect(countLines("")).toBe(0);
  });

  it("counts single line", () => {
    expect(countLines("hello")).toBe(1);
  });

  it("counts multiple lines", () => {
    expect(countLines("a\nb\nc")).toBe(3);
  });

  it("counts trailing newline as extra line", () => {
    expect(countLines("a\nb\n")).toBe(3);
  });
});

describe("isBinaryByExtension", () => {
  it("detects binary extensions", () => {
    expect(isBinaryByExtension("photo.png")).toBe(true);
    expect(isBinaryByExtension("video.mp4")).toBe(true);
    expect(isBinaryByExtension("archive.zip")).toBe(true);
    expect(isBinaryByExtension("app.exe")).toBe(true);
  });

  it("returns false for text extensions", () => {
    expect(isBinaryByExtension("code.js")).toBe(false);
    expect(isBinaryByExtension("readme.md")).toBe(false);
    expect(isBinaryByExtension("data.json")).toBe(false);
  });
});

describe("isBinaryByContent", () => {
  it("detects null bytes as binary", () => {
    expect(isBinaryByContent(new Uint8Array([72, 101, 0, 108]))).toBe(true);
  });

  it("detects control characters as binary", () => {
    expect(isBinaryByContent(new Uint8Array([1, 2, 3]))).toBe(true);
  });

  it("returns false for ASCII text", () => {
    const text = new TextEncoder().encode("Hello, world!\n");
    expect(isBinaryByContent(text)).toBe(false);
  });

  it("returns false for empty content", () => {
    expect(isBinaryByContent(new Uint8Array([]))).toBe(false);
  });
});

describe("isArchiveFile", () => {
  it("detects zip variants", () => {
    expect(isArchiveFile("file.zip")).toBe(true);
    expect(isArchiveFile("lib.jar")).toBe(true);
    expect(isArchiveFile("app.apk")).toBe(true);
  });

  it("detects tar variants", () => {
    expect(isArchiveFile("data.tar")).toBe(true);
    expect(isArchiveFile("data.tar.gz")).toBe(true);
    expect(isArchiveFile("data.tgz")).toBe(true);
  });

  it("returns false for non-archives", () => {
    expect(isArchiveFile("file.txt")).toBe(false);
    expect(isArchiveFile("photo.png")).toBe(false);
  });
});

describe("decodeWithEncoding", () => {
  it("decodes utf-8", () => {
    const bytes = new TextEncoder().encode("hello");
    expect(decodeWithEncoding(bytes, "utf-8")).toBe("hello");
  });

  it("decodes ascii", () => {
    const bytes = new Uint8Array([65, 66, 67]);
    expect(decodeWithEncoding(bytes, "ascii")).toBe("ABC");
  });
});

describe("toBlob", () => {
  it("creates a blob from bytes", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const blob = toBlob(bytes, "application/octet-stream");
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBe(3);
    expect(blob.type).toBe("application/octet-stream");
  });

  it("creates a blob without type", () => {
    const blob = toBlob(new Uint8Array([10, 20]));
    expect(blob.size).toBe(2);
    expect(blob.type).toBe("");
  });

  it("handles subarrays correctly", () => {
    const full = new Uint8Array([0, 1, 2, 3, 4, 5]);
    const sub = full.subarray(2, 4);
    const blob = toBlob(sub);
    expect(blob.size).toBe(2);
  });
});

describe("detectBOM", () => {
  it("detects UTF-8 BOM", () => {
    const bytes = new Uint8Array([0xEF, 0xBB, 0xBF, 0x48, 0x65, 0x6C]);
    const result = detectBOM(bytes);
    expect(result).toEqual({ encoding: "utf-8", bomLength: 3 });
  });

  it("detects UTF-16LE BOM", () => {
    const bytes = new Uint8Array([0xFF, 0xFE, 0x48, 0x00]);
    const result = detectBOM(bytes);
    expect(result).toEqual({ encoding: "utf-16le", bomLength: 2 });
  });

  it("detects UTF-16BE BOM", () => {
    const bytes = new Uint8Array([0xFE, 0xFF, 0x00, 0x48]);
    const result = detectBOM(bytes);
    expect(result).toEqual({ encoding: "utf-16be", bomLength: 2 });
  });

  it("returns null for no BOM", () => {
    const bytes = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]);
    expect(detectBOM(bytes)).toBeNull();
  });

  it("returns null for empty bytes", () => {
    expect(detectBOM(new Uint8Array([]))).toBeNull();
  });

  it("returns null for single byte", () => {
    expect(detectBOM(new Uint8Array([0xEF]))).toBeNull();
  });

  it("returns null for partial UTF-8 BOM (2 bytes)", () => {
    expect(detectBOM(new Uint8Array([0xEF, 0xBB]))).toBeNull();
  });
});
