import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadSettings, saveSettings, getDefaults, type Settings } from "../settings";

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

describe("getDefaults", () => {
  it("returns default settings", () => {
    const d = getDefaults();
    expect(d).toEqual({
      fontSize: 13,
      tabSize: 2,
      wordWrap: false,
      minimap: false,
      lineNumbers: true,
    });
  });

  it("returns a new object each call", () => {
    expect(getDefaults()).not.toBe(getDefaults());
  });
});

describe("loadSettings", () => {
  it("returns defaults when storage is empty", () => {
    expect(loadSettings()).toEqual(getDefaults());
  });

  it("returns defaults on invalid JSON", () => {
    mockStorage["shoshum-settings"] = "not json";
    expect(loadSettings()).toEqual(getDefaults());
  });

  it("merges stored values over defaults", () => {
    mockStorage["shoshum-settings"] = JSON.stringify({ fontSize: 18, wordWrap: true });
    const s = loadSettings();
    expect(s.fontSize).toBe(18);
    expect(s.wordWrap).toBe(true);
    expect(s.tabSize).toBe(2);
    expect(s.lineNumbers).toBe(true);
  });

  it("ignores extra unknown keys", () => {
    mockStorage["shoshum-settings"] = JSON.stringify({ fontSize: 14, unknownProp: "hello" });
    const s = loadSettings();
    expect(s.fontSize).toBe(14);
    expect((s as Record<string, unknown>)["unknownProp"]).toBe("hello");
  });
});

describe("saveSettings", () => {
  it("persists settings to localStorage", () => {
    const s: Settings = { fontSize: 16, tabSize: 4, wordWrap: true, minimap: true, lineNumbers: false };
    saveSettings(s);
    expect(storageMock.setItem).toHaveBeenCalledWith("shoshum-settings", JSON.stringify(s));
  });

  it("round-trips through load", () => {
    const s: Settings = { fontSize: 20, tabSize: 8, wordWrap: true, minimap: false, lineNumbers: true };
    saveSettings(s);
    expect(loadSettings()).toEqual(s);
  });
});
