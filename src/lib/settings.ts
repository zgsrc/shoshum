export interface Settings {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
}

const STORAGE_KEY = "shoshum-settings";

const DEFAULTS: Settings = {
  fontSize: 13,
  tabSize: 2,
  wordWrap: false,
  minimap: false,
  lineNumbers: true,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function getDefaults(): Settings {
  return { ...DEFAULTS };
}
