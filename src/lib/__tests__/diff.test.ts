import { describe, it, expect } from "vitest";
import { computeDiff, getDiffStats } from "../diff";

describe("computeDiff", () => {
  it("treats two empty strings as one identical empty line", () => {
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

  it("handles one side empty (all removed)", () => {
    const lines = computeDiff("a\nb\nc", "");
    const stats = getDiffStats(lines);
    expect(stats.removed).toBe(3);
    expect(stats.added).toBe(1);
    expect(stats.same).toBe(0);
  });

  it("handles one side empty (all added)", () => {
    const lines = computeDiff("", "x\ny\nz");
    const stats = getDiffStats(lines);
    expect(stats.added).toBe(3);
    expect(stats.removed).toBe(1);
    expect(stats.same).toBe(0);
  });

  it("handles single line to empty", () => {
    const lines = computeDiff("hello", "");
    expect(lines.some((l) => l.type === "removed" && l.content === "hello")).toBe(true);
  });

  it("handles empty to single line", () => {
    const lines = computeDiff("", "hello");
    expect(lines.some((l) => l.type === "added" && l.content === "hello")).toBe(true);
  });

  it("handles multiple insertions in sequence", () => {
    const lines = computeDiff("a\nd", "a\nb\nc\nd");
    const stats = getDiffStats(lines);
    expect(stats.same).toBe(2);
    expect(stats.added).toBe(2);
    expect(stats.removed).toBe(0);
  });

  it("handles multiple deletions in sequence", () => {
    const lines = computeDiff("a\nb\nc\nd", "a\nd");
    const stats = getDiffStats(lines);
    expect(stats.same).toBe(2);
    expect(stats.removed).toBe(2);
    expect(stats.added).toBe(0);
  });

  it("handles interleaved changes", () => {
    const lines = computeDiff("a\nb\nc\nd\ne", "a\nB\nc\nD\ne");
    const stats = getDiffStats(lines);
    expect(stats.same).toBe(3);
    expect(stats.added).toBe(2);
    expect(stats.removed).toBe(2);
  });

  it("produces valid monotonic line numbers", () => {
    const lines = computeDiff("a\nb\nc\nd", "a\nx\nc\ny");
    let lastOld = 0;
    let lastNew = 0;
    for (const line of lines) {
      if (line.oldLineNum != null) {
        expect(line.oldLineNum).toBeGreaterThan(lastOld);
        lastOld = line.oldLineNum;
      }
      if (line.newLineNum != null) {
        expect(line.newLineNum).toBeGreaterThan(lastNew);
        lastNew = line.newLineNum;
      }
    }
  });

  it("handles large identical content efficiently", () => {
    const lines = Array.from({ length: 2000 }, (_, i) => `line ${i}`);
    const text = lines.join("\n");
    const start = performance.now();
    const result = computeDiff(text, text);
    const elapsed = performance.now() - start;
    expect(result).toHaveLength(2000);
    expect(elapsed).toBeLessThan(200);
  });

  it("handles moderately large diff efficiently (Myers vs O(nm))", () => {
    const oldLines = Array.from({ length: 500 }, (_, i) => `line ${i}`);
    const newLines = [
      ...oldLines.slice(0, 100),
      "inserted A",
      "inserted B",
      ...oldLines.slice(100, 300),
      ...oldLines.slice(350, 500),
      "appended X",
    ];
    const start = performance.now();
    const result = computeDiff(oldLines.join("\n"), newLines.join("\n"));
    const elapsed = performance.now() - start;
    const stats = getDiffStats(result);
    expect(stats.added).toBe(3);
    expect(stats.removed).toBe(50);
    expect(elapsed).toBeLessThan(200);
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
