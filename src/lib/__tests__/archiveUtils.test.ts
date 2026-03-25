import { describe, it, expect } from "vitest";
import {
  MAX_ARCHIVE_INPUT_BYTES,
  MAX_ARCHIVE_ENTRY_BYTES,
  MAX_ARCHIVE_ENTRIES,
  INVALID_ARCHIVE_PASSWORD_MESSAGE,
  isInvalidArchivePasswordError,
} from "../archiveUtils";

describe("archive constants", () => {
  it("has reasonable limits", () => {
    expect(MAX_ARCHIVE_INPUT_BYTES).toBe(64 * 1024 * 1024);
    expect(MAX_ARCHIVE_ENTRY_BYTES).toBe(24 * 1024 * 1024);
    expect(MAX_ARCHIVE_ENTRIES).toBe(5000);
  });

  it("has a defined password error message", () => {
    expect(INVALID_ARCHIVE_PASSWORD_MESSAGE).toBe("Invalid password");
  });
});

describe("isInvalidArchivePasswordError", () => {
  it("returns true for matching error", () => {
    expect(isInvalidArchivePasswordError(new Error("Invalid password"))).toBe(true);
  });

  it("returns false for different error message", () => {
    expect(isInvalidArchivePasswordError(new Error("Something else"))).toBe(false);
  });

  it("returns false for non-Error", () => {
    expect(isInvalidArchivePasswordError("Invalid password")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isInvalidArchivePasswordError(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isInvalidArchivePasswordError(undefined)).toBe(false);
  });

  it("returns false for number", () => {
    expect(isInvalidArchivePasswordError(42)).toBe(false);
  });
});
