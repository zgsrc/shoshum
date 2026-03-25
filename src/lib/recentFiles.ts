const STORAGE_KEY = "shoshum-recent";
const MAX_RECENT = 20;

export interface RecentFile {
  name: string;
  size: number;
  format: string;
  lastOpened: number;
}

export function getRecentFiles(): RecentFile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentFile(file: RecentFile): void {
  const recent = getRecentFiles().filter((f) => f.name !== file.name);
  recent.unshift(file);
  if (recent.length > MAX_RECENT) recent.pop();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
}

export function clearRecentFiles(): void {
  localStorage.removeItem(STORAGE_KEY);
}
