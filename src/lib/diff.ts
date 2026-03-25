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

  if (oldLines.length > 5000 || newLines.length > 5000) {
    return simpleDiff(oldLines, newLines);
  }

  return lcsDiff(oldLines, newLines);
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

function simpleDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const result: DiffLine[] = [];
  const maxLen = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLen; i++) {
    if (i < oldLines.length && i < newLines.length) {
      if (oldLines[i] === newLines[i]) {
        result.push({ type: "same", content: oldLines[i], oldLineNum: i + 1, newLineNum: i + 1 });
      } else {
        result.push({ type: "removed", content: oldLines[i], oldLineNum: i + 1 });
        result.push({ type: "added", content: newLines[i], newLineNum: i + 1 });
      }
    } else if (i < oldLines.length) {
      result.push({ type: "removed", content: oldLines[i], oldLineNum: i + 1 });
    } else {
      result.push({ type: "added", content: newLines[i], newLineNum: i + 1 });
    }
  }

  return result;
}

function lcsDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const n = oldLines.length;
  const m = newLines.length;

  const dp: number[][] = [];
  for (let i = 0; i <= n; i++) {
    dp[i] = new Array(m + 1).fill(0);
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const temp: DiffLine[] = [];
  let i = n, j = m;
  let oldNum = n, newNum = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      temp.push({ type: "same", content: oldLines[i - 1], oldLineNum: oldNum, newLineNum: newNum });
      i--; j--; oldNum--; newNum--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      temp.push({ type: "added", content: newLines[j - 1], newLineNum: newNum });
      j--; newNum--;
    } else {
      temp.push({ type: "removed", content: oldLines[i - 1], oldLineNum: oldNum });
      i--; oldNum--;
    }
  }

  return temp.reverse();
}
