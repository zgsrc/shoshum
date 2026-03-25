import { describe, it, expect, beforeEach, vi } from "vitest";
import { getRecentFiles, addRecentFile, clearRecentFiles, type RecentFile } from "../recentFiles";

const mockStorage: Record<string, string> = {};
const storageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
  clear: vi.fn(() => { for (const k of Object.keys(mockStorage)) delete mockStorage[k]; }),
  get length() { return Object.keys(mockStorage).length; },
  key: vi.fn(),
};

Object.defineProperty(globalThis, "localStorage", { value: storageMock, writable: true });

beforeEach(() => {
  storageMock.clear();
  vi.clearAllMocks();
});

function makeFile(name: string): RecentFile {
  return { name, size: 100, format: "text", lastOpened: Date.now() };
}

describe("getRecentFiles", () => {
  it("returns empty array when storage is empty", () => {
    expect(getRecentFiles()).toEqual([]);
  });

  it("returns empty array on invalid JSON", () => {
    mockStorage["shoshum-recent"] = "not json";
    expect(getRecentFiles()).toEqual([]);
  });

  it("parses stored array", () => {
    const files = [makeFile("a.txt"), makeFile("b.txt")];
    mockStorage["shoshum-recent"] = JSON.stringify(files);
    expect(getRecentFiles()).toEqual(files);
  });
});

describe("addRecentFile", () => {
  it("adds a file to the list", () => {
    addRecentFile(makeFile("test.js"));
    const recent = getRecentFiles();
    expect(recent).toHaveLength(1);
    expect(recent[0].name).toBe("test.js");
  });

  it("puts the newest file first", () => {
    addRecentFile(makeFile("a.txt"));
    addRecentFile(makeFile("b.txt"));
    const recent = getRecentFiles();
    expect(recent[0].name).toBe("b.txt");
    expect(recent[1].name).toBe("a.txt");
  });

  it("deduplicates by name (re-adding moves to top)", () => {
    addRecentFile(makeFile("a.txt"));
    addRecentFile(makeFile("b.txt"));
    addRecentFile(makeFile("a.txt"));
    const recent = getRecentFiles();
    expect(recent).toHaveLength(2);
    expect(recent[0].name).toBe("a.txt");
  });

  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      addRecentFile(makeFile(`file-${i}.txt`));
    }
    const recent = getRecentFiles();
    expect(recent.length).toBeLessThanOrEqual(20);
    expect(recent[0].name).toBe("file-24.txt");
  });
});

describe("clearRecentFiles", () => {
  it("removes all recent files", () => {
    addRecentFile(makeFile("a.txt"));
    addRecentFile(makeFile("b.txt"));
    clearRecentFiles();
    expect(getRecentFiles()).toEqual([]);
  });

  it("calls removeItem on the correct key", () => {
    clearRecentFiles();
    expect(storageMock.removeItem).toHaveBeenCalledWith("shoshum-recent");
  });
});
