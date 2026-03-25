export interface DiffLine {
  type: "same" | "added" | "removed";
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

export interface DiffStats {
  added: number;
  removed: number;
  same: number;
}

export function computeDiff(original: string, modified: string): DiffLine[] {
  const oldLines = original.split("\n");
  const newLines = modified.split("\n");
  return myersDiff(oldLines, newLines);
}

export function getDiffStats(lines: DiffLine[]): DiffStats {
  let added = 0, removed = 0, same = 0;
  for (const line of lines) {
    if (line.type === "added") added++;
    else if (line.type === "removed") removed++;
    else same++;
  }
  return { added, removed, same };
}

/**
 * Myers diff algorithm — O(ND) time, O(N) space where D is the edit distance.
 * Far faster and more memory-efficient than the previous O(NM) LCS approach
 * for inputs that are mostly similar (small D).
 */
function myersDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const n = oldLines.length;
  const m = newLines.length;
  const max = n + m;

  if (max === 0) {
    return [];
  }

  // Fast path: identical
  if (n === m) {
    let identical = true;
    for (let i = 0; i < n; i++) {
      if (oldLines[i] !== newLines[i]) { identical = false; break; }
    }
    if (identical) {
      return oldLines.map((line, i) => ({
        type: "same" as const,
        content: line,
        oldLineNum: i + 1,
        newLineNum: i + 1,
      }));
    }
  }

  // Fast path: one side empty
  if (n === 0) {
    return newLines.map((line, i) => ({
      type: "added" as const,
      content: line,
      newLineNum: i + 1,
    }));
  }
  if (m === 0) {
    return oldLines.map((line, i) => ({
      type: "removed" as const,
      content: line,
      oldLineNum: i + 1,
    }));
  }

  const editScript = shortestEdit(oldLines, newLines, n, m, max);
  return buildDiffLines(oldLines, newLines, editScript);
}

type Edit = { type: "same" | "added" | "removed"; oldIdx: number; newIdx: number };

function shortestEdit(
  oldLines: string[],
  newLines: string[],
  n: number,
  m: number,
  max: number,
): Edit[] {
  // v[k] = furthest reaching x on diagonal k
  // diagonals range from -max to +max, indexed as k + offset
  const size = 2 * max + 1;
  const v = new Int32Array(size);
  const offset = max;

  // Store the trace for backtracking
  const trace: Int32Array[] = [];

  outer:
  for (let d = 0; d <= max; d++) {
    const snapshot = new Int32Array(v);
    trace.push(snapshot);

    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[k - 1 + offset] < v[k + 1 + offset])) {
        x = v[k + 1 + offset]; // move down (insert)
      } else {
        x = v[k - 1 + offset] + 1; // move right (delete)
      }

      let y = x - k;

      // Follow the snake (diagonal of matches)
      while (x < n && y < m && oldLines[x] === newLines[y]) {
        x++;
        y++;
      }

      v[k + offset] = x;

      if (x >= n && y >= m) {
        break outer;
      }
    }
  }

  // Backtrack to build the edit script
  const edits: Edit[] = [];
  let x = n;
  let y = m;

  for (let d = trace.length - 1; d >= 0; d--) {
    const k = x - y;
    const prev = trace[d];

    let prevK: number;
    if (k === -d || (k !== d && prev[k - 1 + offset] < prev[k + 1 + offset])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }

    const prevX = prev[prevK + offset];
    const prevY = prevX - prevK;

    // Record the snake (diagonal matches) in reverse
    while (x > prevX && y > prevY) {
      x--;
      y--;
      edits.push({ type: "same", oldIdx: x, newIdx: y });
    }

    if (d > 0) {
      if (x === prevX) {
        // Insert
        y--;
        edits.push({ type: "added", oldIdx: x, newIdx: y });
      } else {
        // Delete
        x--;
        edits.push({ type: "removed", oldIdx: x, newIdx: y });
      }
    }
  }

  edits.reverse();
  return edits;
}

function buildDiffLines(
  oldLines: string[],
  newLines: string[],
  edits: Edit[],
): DiffLine[] {
  const result: DiffLine[] = [];
  let oldNum = 1;
  let newNum = 1;

  for (const edit of edits) {
    if (edit.type === "same") {
      result.push({
        type: "same",
        content: oldLines[edit.oldIdx],
        oldLineNum: oldNum++,
        newLineNum: newNum++,
      });
    } else if (edit.type === "removed") {
      result.push({
        type: "removed",
        content: oldLines[edit.oldIdx],
        oldLineNum: oldNum++,
      });
    } else {
      result.push({
        type: "added",
        content: newLines[edit.newIdx],
        newLineNum: newNum++,
      });
    }
  }

  return result;
}
