import { describe, it, expect } from "vitest";
import { computeDiff, getDiffStats } from "../diff";

describe("computeDiff", () => {
  it("returns empty array for two empty strings", () => {
    const lines = computeDiff("", "");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({ type: "same", content: "", oldLineNum: 1, newLineNum: 1 });
  });

  it("detects identical content", () => {
    const text = "line1\nline2\nline3";
    const lines = computeDiff(text, text);
    expect(lines).toHaveLength(3);
    lines.forEach((l) => expect(l.type).toBe("same"));
  });

  it("detects an added line", () => {
    const lines = computeDiff("a\nb", "a\nx\nb");
    const stats = getDiffStats(lines);
    expect(stats.added).toBe(1);
    expect(stats.removed).toBe(0);
    expect(stats.same).toBe(2);
    expect(lines.find((l) => l.type === "added")?.content).toBe("x");
  });

  it("detects a removed line", () => {
    const lines = computeDiff("a\nx\nb", "a\nb");
    const stats = getDiffStats(lines);
    expect(stats.removed).toBe(1);
    expect(stats.added).toBe(0);
    expect(lines.find((l) => l.type === "removed")?.content).toBe("x");
  });

  it("detects a changed line as remove + add", () => {
    const lines = computeDiff("hello", "world");
    const stats = getDiffStats(lines);
    expect(stats.removed).toBe(1);
    expect(stats.added).toBe(1);
  });

  it("handles completely different content", () => {
    const lines = computeDiff("a\nb\nc", "x\ny\nz");
    const stats = getDiffStats(lines);
    expect(stats.removed).toBe(3);
    expect(stats.added).toBe(3);
    expect(stats.same).toBe(0);
  });

  it("assigns correct line numbers for insertions", () => {
    const lines = computeDiff("a\nb", "a\nx\nb");
    const sameBefore = lines.find((l) => l.type === "same" && l.content === "a");
    expect(sameBefore?.oldLineNum).toBe(1);
    expect(sameBefore?.newLineNum).toBe(1);

    const added = lines.find((l) => l.type === "added");
    expect(added?.newLineNum).toBe(2);

    const sameAfter = lines.find((l) => l.type === "same" && l.content === "b");
    expect(sameAfter?.oldLineNum).toBe(2);
    expect(sameAfter?.newLineNum).toBe(3);
  });
});

describe("getDiffStats", () => {
  it("counts zero for empty input", () => {
    expect(getDiffStats([])).toEqual({ added: 0, removed: 0, same: 0 });
  });

  it("counts mixed types correctly", () => {
    const stats = getDiffStats([
      { type: "same", content: "a" },
      { type: "removed", content: "b" },
      { type: "added", content: "c" },
      { type: "added", content: "d" },
    ]);
    expect(stats).toEqual({ added: 2, removed: 1, same: 1 });
  });
});
