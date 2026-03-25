"use client";

import { useState, useCallback, useRef, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  type FileData,
  type FileFormat,
  shouldAutoDisplay,
  detectFormat,
  formatBytes,
  formatLabel,
  countLines,
  detectLineEnding,
  convertLineEnding,
  decodeWithEncoding,
  detectBOM,
  isBinaryByContent,
  isBinaryByExtension,
  SUPPORTED_ENCODINGS,
  type LineEnding,
  toBlob,
} from "@/lib/fileUtils";
import {
  extractArchiveEntries,
  extractArchiveEntry,
  isInvalidArchivePasswordError,
  loadArchiveData,
  type ArchiveData,
  type ArchiveEntrySummary,
} from "@/lib/archiveUtils";
import { type Settings, loadSettings, saveSettings } from "@/lib/settings";
import { getRecentFiles, addRecentFile, clearRecentFiles, type RecentFile } from "@/lib/recentFiles";
import { prettyPrintJSON, minifyJSON, prettyPrintXML, minifyXML } from "@/lib/formatters";
import type { TestFixture, TestFixtureId } from "@/lib/testFixtures";
import ArchiveBrowser from "@/components/ArchiveBrowser";
import CodeEditor, { type CodeEditorRef, type EditorSnapshot } from "./CodeEditor";
import DisplayViewer from "./DisplayViewer";
import HexViewer from "./HexViewer";
import MarkdownPreview from "./MarkdownPreview";
import TabBar, { type TabInfo } from "./TabBar";
import CommandPalette, { type Command } from "./CommandPalette";
import SettingsPanel from "./SettingsPanel";
import GoToLine from "./GoToLine";
import DiffView from "./DiffView";
import ShortcutGuide from "./ShortcutGuide";
import PasswordPrompt from "./PasswordPrompt";
import TestFixturePanel from "./TestFixturePanel";
import GlobalSearch, { type SearchableTab } from "./GlobalSearch";

type ViewMode = "auto" | "archive" | "display" | "text" | "binary";
type EffectiveViewMode = Exclude<ViewMode, "auto">;
type ThemePreference = "auto" | "dark" | "light";
type ResolvedTheme = "dark" | "light";
type MarkdownMode = "edit" | "preview" | "split";

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  auto: "Auto",
  archive: "Archive",
  display: "Display",
  text: "Text",
  binary: "Binary",
};

const THEME_STORAGE_KEY = "shoshum-theme";
const THEME_CHANGE_EVENT = "shoshum-theme-change";

function readStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "auto";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "auto" ? stored : "auto";
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function resolveTheme(pref: ThemePreference): ResolvedTheme {
  return pref === "auto" ? getSystemTheme() : pref;
}

function subscribeToThemeChange(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = () => callback();
  window.addEventListener("storage", handler);
  window.addEventListener(THEME_CHANGE_EVENT, handler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(THEME_CHANGE_EVENT, handler);
  };
}

interface Tab {
  id: string;
  fileData: FileData;
  currentContent: string;
  currentBytes: Uint8Array;
  originalContent: string;
  modified: boolean;
  viewMode: ViewMode;
  encoding: string;
  markdownMode: MarkdownMode;
  readOnly: boolean;
  readOnlyReason: string | null;
  archiveData: ArchiveData | null;
  archiveOrigin: { archiveName: string; entryPath: string } | null;
  sourceKey: string | null;
}

interface ArchivePasswordPromptState {
  action: "open" | "export";
  archiveTabId: string;
  archiveName: string;
  entryPaths: string[];
  suggestedName?: string | null;
  errorMessage: string | null;
}

interface TestModeConfig {
  enabled: boolean;
  autoFixtureId: TestFixtureId | null;
}

let nextId = 0;
function genId() {
  return `tab-${++nextId}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function isTestFixtureId(value: string | null): value is TestFixtureId {
  return value === "locked-pdf" || value === "locked-zip";
}

function readTestModeConfig(): TestModeConfig {
  if (typeof window === "undefined") {
    return { enabled: false, autoFixtureId: null };
  }

  const params = new URLSearchParams(window.location.search);
  const enabled = params.get("testMode") === "1";
  const fixtureParam = params.get("fixture");

  return {
    enabled,
    autoFixtureId: enabled && isTestFixtureId(fixtureParam) ? fixtureParam : null,
  };
}

function createByteBlob(
  bytes: Uint8Array,
  mimeType = "application/octet-stream"
): Blob {
  return toBlob(bytes, mimeType);
}

function getLeafName(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "download";
}

function canSaveTab(tab: Tab | null): boolean {
  if (!tab) return false;
  if (tab.fileData.format === "archive") return false;
  if (tab.archiveOrigin) return true;
  return !tab.readOnly;
}

function getSaveActionLabel(tab: Tab | null): string {
  return tab?.archiveOrigin ? "Export Copy" : "Save File";
}

function getSaveActionTitle(tab: Tab | null): string {
  if (!tab) return "Save file";
  if (tab.fileData.format === "archive") {
    return "Browse the archive to open or save an entry";
  }
  if (tab.archiveOrigin) {
    return "Export extracted copy (⌘S)";
  }
  return tab.readOnly ? tab.readOnlyReason ?? "This tab is read-only." : "Save file (⌘S)";
}

function getArchivePasswordPromptDescription(
  prompt: ArchivePasswordPromptState
): string {
  if (prompt.action === "open") {
    return `Enter the password to open "${prompt.entryPaths[0]}" from ${prompt.archiveName}.`;
  }

  if (prompt.entryPaths.length === 1) {
    return `Enter the password to save "${prompt.entryPaths[0]}" from ${prompt.archiveName}.`;
  }

  return `Enter the password to save ${prompt.entryPaths.length.toLocaleString()} selected entries from ${prompt.archiveName}.`;
}

function getArchivePasswordSubmitLabel(
  prompt: ArchivePasswordPromptState
): string {
  if (prompt.action === "open") return "Unlock Entry";
  return prompt.entryPaths.length === 1 ? "Save Entry" : "Save Entries";
}

function stripArchiveExtension(name: string): string {
  return name.replace(
    /(\.tar\.gz|\.tgz|\.zip|\.jar|\.war|\.ear|\.apk|\.tar)$/i,
    ""
  );
}

function buildArchiveBatchExportName(
  archiveName: string,
  suggestedName?: string | null
): string {
  const base = stripArchiveExtension(getLeafName(archiveName)) || "archive";
  const normalizedLabel = (suggestedName ?? "selection")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "selection";
  return `${base}-${normalizedLabel}.zip`;
}

async function writeArchiveEntryToDirectory(
  root: FileSystemDirectoryHandle,
  entryPath: string,
  bytes: Uint8Array
): Promise<void> {
  const parts = entryPath
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.replace(/[\u0000-\u001f\u007f]/g, ""))
    .filter(Boolean);
  if (parts.length === 0) return;
  if (parts.some((part) => part === "." || part === "..")) {
    throw new Error(`"${entryPath}" could not be exported safely.`);
  }

  let directory = root;
  for (const part of parts.slice(0, -1)) {
    directory = await directory.getDirectoryHandle(part, { create: true });
  }

  const fileName = parts[parts.length - 1]!;
  const fileHandle = await directory.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(createByteBlob(bytes));
  await writable.close();
}

async function createZipBytes(
  entries: { path: string; bytes: Uint8Array }[]
): Promise<Uint8Array> {
  const { BlobWriter, Uint8ArrayReader, ZipWriter } = await import("@zip.js/zip.js");
  const blobWriter = new BlobWriter("application/zip");
  const zipWriter = new ZipWriter(blobWriter, { useWebWorkers: false });

  for (const entry of entries) {
    await zipWriter.add(
      entry.path,
      new Uint8ArrayReader(Uint8Array.from(entry.bytes)),
      { useWebWorkers: false }
    );
  }

  const blob = await zipWriter.close();
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

// ── Theme Hook ──────────────────────────────────────────────

function useTheme(): [ThemePreference, ResolvedTheme, () => void] {
  const preference = useSyncExternalStore<ThemePreference>(
    subscribeToThemeChange,
    readStoredTheme,
    (): ThemePreference => "auto"
  );

  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => {
      setSystemTheme(mql.matches ? "light" : "dark");
      if (readStoredTheme() === "auto") {
        window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
      }
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const resolved: ResolvedTheme = preference === "auto" ? systemTheme : preference;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
  }, [resolved]);

  const toggle = useCallback(() => {
    const order: ThemePreference[] = ["auto", "light", "dark"];
    const next = order[(order.indexOf(preference) + 1) % order.length];
    localStorage.setItem(THEME_STORAGE_KEY, next);
    document.documentElement.setAttribute("data-theme", next === "auto" ? getSystemTheme() : next);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, [preference]);

  return [preference, resolved, toggle];
}

// ── Icon Components ─────────────────────────────────────────

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
function AutoThemeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

// ── Toolbar Button ──────────────────────────────────────────

function TBtn({
  onClick,
  title,
  accent,
  disabled,
  children,
}: {
  onClick: () => void;
  title: string;
  accent?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 rounded transition-colors disabled:cursor-default disabled:opacity-50"
      title={title}
      style={{ color: disabled ? "var(--sh-text-muted)" : accent ? "var(--sh-accent-blue)" : "var(--sh-text2)" }}
      onMouseEnter={(e) => {
        if (disabled) return;
        if (!accent) e.currentTarget.style.color = "var(--sh-text)";
        e.currentTarget.style.backgroundColor = "var(--sh-bg-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = disabled
          ? "var(--sh-text-muted)"
          : accent
            ? "var(--sh-accent-blue)"
            : "var(--sh-text2)";
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {children}
    </button>
  );
}

// ── Landing Page ────────────────────────────────────────────

function LandingPage({ onFile, onOpenPicker, themePreference, onToggleTheme, recentFiles, onClearRecent }: {
  onFile: (file: File, handle: FileSystemFileHandle | null) => void;
  onOpenPicker: () => void;
  themePreference: ThemePreference;
  onToggleTheme: () => void;
  recentFiles: RecentFile[];
  onClearRecent: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <header className="flex items-center justify-between h-10 px-3 shrink-0" style={{ backgroundColor: "var(--sh-bg2)", borderBottom: "1px solid var(--sh-border)" }}>
        <div className="w-8" />
        <h1 className="text-sm font-semibold tracking-wide font-mono" style={{ color: "var(--sh-text)" }}>shoshum</h1>
        <TBtn onClick={onToggleTheme} title={`Theme: ${themePreference} (click to cycle)`}>
          {themePreference === "auto" ? <AutoThemeIcon /> : themePreference === "dark" ? <SunIcon /> : <MoonIcon />}
        </TBtn>
      </header>
      <div
        className="flex flex-col items-center justify-center flex-1 transition-colors"
        style={{ backgroundColor: dragging ? "var(--sh-drag-bg)" : "transparent" }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onFile(f, null); }}
      >
        <div className="flex flex-col items-center gap-6 max-w-lg text-center">
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl" style={{ backgroundColor: "var(--sh-bg2)", border: "1px solid var(--sh-bg-active)" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--sh-accent-blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-medium mb-2" style={{ color: "var(--sh-text)" }}>Open a file</h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--sh-text2)" }}>
              Drop any file here, or click to browse. Text files get syntax highlighting, binary files open in a byte editor, display mode previews files the browser can render, and archives can be browsed and extracted read-only.
            </p>
          </div>
          <button onClick={onOpenPicker} className="px-5 py-2.5 rounded-lg text-white text-sm font-medium transition-colors" style={{ backgroundColor: "var(--sh-btn-green)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--sh-btn-green-hover)")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--sh-btn-green)")}>
            Open File
          </button>
          <input ref={inputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f, null); }} />
          <div className="flex items-center gap-4 text-xs" style={{ color: "var(--sh-text-muted)" }}>
            <span>⌘O open</span><span>⌘S save</span><span>⌘⇧P commands</span><span>? shortcuts</span>
          </div>

          {recentFiles.length > 0 && (
            <div className="w-full mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: "var(--sh-text2)" }}>Recent Files</span>
                <button className="text-xs transition-colors" style={{ color: "var(--sh-text-muted)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--sh-text)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--sh-text-muted)")}
                  onClick={onClearRecent}>Clear</button>
              </div>
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--sh-border)" }}>
                {recentFiles.slice(0, 8).map((rf, i) => (
                  <button key={i} className="flex items-center justify-between w-full px-3 py-1.5 text-left text-xs font-mono transition-colors"
                    style={{ color: "var(--sh-text)", borderBottom: i < Math.min(recentFiles.length, 8) - 1 ? "1px solid var(--sh-border)" : undefined }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--sh-bg-hover)")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    onClick={onOpenPicker}>
                    <span className="truncate">{rf.name}</span>
                    <span style={{ color: "var(--sh-text-muted)" }}>{rf.format}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Drag Overlay ────────────────────────────────────────────

function DragOverlay() {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
      <div className="rounded-2xl px-8 py-6 text-center" style={{ backgroundColor: "var(--sh-bg2)", border: "2px dashed var(--sh-accent-blue)" }}>
        <p className="text-sm font-medium" style={{ color: "var(--sh-text)" }}>Drop file to open in a new tab</p>
      </div>
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────

export default function App() {
  const [themePreference, theme, toggleTheme] = useTheme();
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGoToLine, setShowGoToLine] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [archivePasswordPrompt, setArchivePasswordPrompt] = useState<ArchivePasswordPromptState | null>(null);
  const [testMode, setTestMode] = useState<TestModeConfig>({ enabled: false, autoFixtureId: null });
  const [testFixtures, setTestFixtures] = useState<
    ReadonlyArray<Pick<TestFixture, "id" | "label" | "description" | "password">>
  >([]);
  const [testFixturesLoading, setTestFixturesLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<CodeEditorRef>(null);
  const archivePasswordsRef = useRef<Record<string, string>>({});
  const autoLoadedFixtureRef = useRef<TestFixtureId | null>(null);
  const editorSnapshotsRef = useRef<Record<string, EditorSnapshot>>({});

  const activeTab = useMemo(() => tabs.find((t) => t.id === activeTabId) ?? null, [tabs, activeTabId]);

  const switchTab = useCallback((newId: string) => {
    if (activeTabId && activeTabId !== newId) {
      const snapshot = editorRef.current?.takeSnapshot();
      if (snapshot) {
        editorSnapshotsRef.current[activeTabId] = snapshot;
      }
    }
    setActiveTabId(newId);
  }, [activeTabId]);

  useEffect(() => {
    setRecentFiles(getRecentFiles());
  }, [tabs.length]);

  useEffect(() => {
    const sync = () => setTestMode(readTestModeConfig());
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    if (!testMode.enabled) {
      setTestFixtures([]);
      setTestFixturesLoading(false);
      autoLoadedFixtureRef.current = null;
      return;
    }

    let cancelled = false;
    setTestFixturesLoading(true);

    void import("@/lib/testFixtures")
      .then(({ TEST_FIXTURES }) => {
        if (cancelled) return;
        setTestFixtures(
          TEST_FIXTURES.map(({ id, label, description, password }) => ({
            id,
            label,
            description,
            password,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) {
          setTestFixtures([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTestFixturesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [testMode.enabled]);

  // ── Tab helpers ─────────────────────────────────

  const updateTab = useCallback((id: string, patch: Partial<Tab>) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const closeTab = useCallback((id: string) => {
    const tab = tabs.find((candidate) => candidate.id === id);
    if (tab?.modified && !window.confirm("Unsaved changes. Close anyway?")) return;

    const idx = tabs.findIndex((candidate) => candidate.id === id);
    const next = tabs.filter((candidate) => candidate.id !== id);

    if (id === activeTabId && next.length > 0) {
      setActiveTabId(next[Math.min(idx, next.length - 1)].id);
    } else if (next.length === 0) {
      setActiveTabId(null);
    }

    delete archivePasswordsRef.current[id];
    delete editorSnapshotsRef.current[id];
    setArchivePasswordPrompt((current) =>
      current?.archiveTabId === id ? null : current
    );
    setTabs(next);
  }, [activeTabId, tabs]);

  const closeAllTabs = useCallback(() => {
    const hasModified = tabs.some((t) => t.modified);
    if (hasModified && !window.confirm("Some tabs have unsaved changes. Close all?")) return;
    setTabs([]);
    setActiveTabId(null);
    archivePasswordsRef.current = {};
    editorSnapshotsRef.current = {};
    setArchivePasswordPrompt(null);
  }, [tabs]);

  const reorderTabs = useCallback((fromIdx: number, toIdx: number) => {
    setTabs((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  // ── File operations ─────────────────────────────

  const buildTabFromBytes = useCallback(
    async ({
      name,
      size,
      bytes,
      handle,
      lastModified,
      mimeType,
      encoding = "utf-8",
      readOnly = false,
      archiveOrigin = null,
      sourceKey = null,
    }: {
      name: string;
      size: number;
      bytes: Uint8Array;
      handle: FileSystemFileHandle | null;
      lastModified: number;
      mimeType: string;
      encoding?: string;
      readOnly?: boolean;
      archiveOrigin?: { archiveName: string; entryPath: string } | null;
      sourceKey?: string | null;
    }): Promise<Tab> => {
      const detectedFormat = detectFormat(name);
      const isBinary = isBinaryByExtension(name) || isBinaryByContent(bytes);
      const format: FileFormat =
        detectedFormat === "text" && isBinary ? "binary" : detectedFormat;
      const bom = !isBinary ? detectBOM(bytes) : null;
      const resolvedEncoding = bom ? bom.encoding : encoding;
      const text = isBinary ? "" : decodeWithEncoding(bytes, resolvedEncoding);
      const archiveData =
        format === "archive" ? await loadArchiveData(name, bytes) : null;
      const nextReadOnly = readOnly || format === "archive";
      const readOnlyReason = archiveOrigin
        ? `Extracted from ${archiveOrigin.archiveName}. Archive entries open read-only.`
        : format === "archive"
          ? "Archive contents can be browsed and analyzed, but editing or writing back into an archive is not supported yet."
          : nextReadOnly
            ? "This tab is read-only."
            : null;

      return {
        id: genId(),
        fileData: {
          name,
          size,
          format,
          content: text,
          bytes,
          isBinary,
          handle,
          lastModified,
          mimeType: mimeType || "application/octet-stream",
        },
        currentContent: text,
        currentBytes: bytes,
        originalContent: text,
        modified: false,
        viewMode: format === "archive" ? "archive" : "auto",
        encoding: resolvedEncoding,
        markdownMode: "edit",
        readOnly: nextReadOnly,
        readOnlyReason,
        archiveData,
        archiveOrigin,
        sourceKey,
      };
    },
    []
  );

  const loadTestFixture = useCallback(
    async (fixtureId: TestFixtureId) => {
      const sourceKey = `fixture:${fixtureId}`;
      const existing = tabs.find((candidate) => candidate.sourceKey === sourceKey);
      if (existing) {
        switchTab(existing.id);
        return;
      }

      try {
        const { getTestFixtureById, getTestFixtureBytes } = await import("@/lib/testFixtures");
        const fixture = getTestFixtureById(fixtureId);
        const bytes = getTestFixtureBytes(fixtureId);

        const tab = await buildTabFromBytes({
          name: fixture.fileName,
          size: bytes.byteLength,
          bytes,
          handle: null,
          lastModified: Date.now(),
          mimeType: fixture.mimeType,
          sourceKey,
        });

        setTabs((prev) => [...prev, tab]);
        setActiveTabId(tab.id);
      } catch (error) {
        window.alert(getErrorMessage(error));
      }
    },
    [tabs, buildTabFromBytes, switchTab]
  );

  const saveBytesAsFile = useCallback(
    async ({
      name,
      bytes,
      mimeType = "application/octet-stream",
    }: {
      name: string;
      bytes: Uint8Array;
      mimeType?: string;
    }) => {
      const blob = createByteBlob(bytes, mimeType);

      if ("showSaveFilePicker" in window) {
        try {
          const handle = await (window as unknown as {
            showSaveFilePicker: (opts?: object) => Promise<FileSystemFileHandle>;
          }).showSaveFilePicker({
            suggestedName: getLeafName(name),
          });
          const writable = await (handle as unknown as {
            createWritable: () => Promise<{
              write: (data: Blob) => Promise<void>;
              close: () => Promise<void>;
            }>;
          }).createWritable();
          await writable.write(blob);
          await writable.close();
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          throw error;
        }
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = getLeafName(name);
      anchor.click();
      URL.revokeObjectURL(url);
    },
    []
  );

  const saveArchiveEntriesToDirectory = useCallback(
    async (
      entries: { path: string; bytes: Uint8Array }[]
    ): Promise<boolean | null> => {
      if (!("showDirectoryPicker" in window)) return null;

      try {
        const directory = await (window as unknown as {
          showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
        }).showDirectoryPicker();

        for (const entry of entries) {
          await writeArchiveEntryToDirectory(
            directory,
            entry.path,
            entry.bytes
          );
        }

        return true;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return false;
        }
        throw error;
      }
    },
    []
  );

  const loadFile = useCallback(
    async (
      file: File,
      handle: FileSystemFileHandle | null,
      encoding = "utf-8"
    ) => {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const tab = await buildTabFromBytes({
          name: file.name,
          size: file.size,
          bytes,
          handle,
          lastModified: file.lastModified,
          mimeType: file.type || "application/octet-stream",
          encoding,
        });

        setTabs((prev) => [...prev, tab]);
        setActiveTabId(tab.id);

        addRecentFile({
          name: file.name,
          size: file.size,
          format: formatLabel(tab.fileData.format),
          lastOpened: Date.now(),
        });
      } catch (error) {
        window.alert(getErrorMessage(error));
      }
    },
    [buildTabFromBytes]
  );

  useEffect(() => {
    if (!testMode.enabled || !testMode.autoFixtureId) return;
    if (autoLoadedFixtureRef.current === testMode.autoFixtureId) return;

    autoLoadedFixtureRef.current = testMode.autoFixtureId;
    void loadTestFixture(testMode.autoFixtureId);
  }, [testMode.enabled, testMode.autoFixtureId, loadTestFixture]);

  const openArchiveEntryWithPassword = useCallback(
    async (
      archiveTab: Tab,
      entry: ArchiveEntrySummary,
      password?: string
    ) => {
      if (!archiveTab.archiveData) return;

      const sourceKey = `${archiveTab.id}:${entry.path}`;
      const existing = tabs.find((candidate) => candidate.sourceKey === sourceKey);
      if (existing) {
        switchTab(existing.id);
        return;
      }

      try {
        const bytes = await extractArchiveEntry(
          archiveTab.fileData.bytes,
          archiveTab.archiveData,
          entry.path,
          password
        );
        if (password) {
          archivePasswordsRef.current[archiveTab.id] = password;
        }

        const tab = await buildTabFromBytes({
          name: entry.path,
          size: bytes.byteLength,
          bytes,
          handle: null,
          lastModified: entry.lastModified ?? Date.now(),
          mimeType: "application/octet-stream",
          readOnly: true,
          archiveOrigin: {
            archiveName: archiveTab.fileData.name,
            entryPath: entry.path,
          },
          sourceKey,
        });

        setTabs((prev) => [...prev, tab]);
        setActiveTabId(tab.id);
      } catch (error) {
        if (entry.encrypted && isInvalidArchivePasswordError(error)) {
          if (archivePasswordsRef.current[archiveTab.id] === password) {
            delete archivePasswordsRef.current[archiveTab.id];
          }
          setArchivePasswordPrompt({
            action: "open",
            archiveTabId: archiveTab.id,
            archiveName: archiveTab.fileData.name,
            entryPaths: [entry.path],
            errorMessage: "That password did not unlock this archive entry. Try another password.",
          });
          return;
        }

        window.alert(getErrorMessage(error));
      }
    },
    [tabs, buildTabFromBytes, switchTab]
  );

  const openArchiveEntry = useCallback(
    (archiveTab: Tab, entry: ArchiveEntrySummary) => {
      if (!archiveTab.archiveData) return;

      const sourceKey = `${archiveTab.id}:${entry.path}`;
      const existing = tabs.find((candidate) => candidate.sourceKey === sourceKey);
      if (existing) {
        switchTab(existing.id);
        return;
      }

      const cachedPassword = entry.encrypted
        ? archivePasswordsRef.current[archiveTab.id]
        : undefined;

      if (entry.encrypted && !cachedPassword) {
        setArchivePasswordPrompt({
          action: "open",
          archiveTabId: archiveTab.id,
          archiveName: archiveTab.fileData.name,
          entryPaths: [entry.path],
          errorMessage: null,
        });
        return;
      }

      void openArchiveEntryWithPassword(archiveTab, entry, cachedPassword);
    },
    [tabs, openArchiveEntryWithPassword, switchTab]
  );

  const exportArchiveEntriesWithPassword = useCallback(
    async (
      archiveTab: Tab,
      entries: ArchiveEntrySummary[],
      password?: string,
      suggestedName?: string | null
    ) => {
      if (!archiveTab.archiveData || entries.length === 0) return;

      try {
        const extractedEntries = await extractArchiveEntries(
          archiveTab.fileData.bytes,
          archiveTab.archiveData,
          entries.map((entry) => entry.path),
          entries.some((entry) => entry.encrypted) ? password : undefined
        );

        if (password && entries.some((entry) => entry.encrypted)) {
          archivePasswordsRef.current[archiveTab.id] = password;
        }

        if (extractedEntries.length === 1) {
          await saveBytesAsFile({
            name: extractedEntries[0]!.path,
            bytes: extractedEntries[0]!.bytes,
          });
          return;
        }

        const directoryResult = await saveArchiveEntriesToDirectory(
          extractedEntries
        );
        if (directoryResult !== null) {
          return;
        }

        const zipBytes = await createZipBytes(extractedEntries);
        await saveBytesAsFile({
          name: buildArchiveBatchExportName(
            archiveTab.fileData.name,
            suggestedName
          ),
          bytes: zipBytes,
          mimeType: "application/zip",
        });
      } catch (error) {
        if (
          entries.some((entry) => entry.encrypted) &&
          isInvalidArchivePasswordError(error)
        ) {
          if (archivePasswordsRef.current[archiveTab.id] === password) {
            delete archivePasswordsRef.current[archiveTab.id];
          }
          setArchivePasswordPrompt({
            action: "export",
            archiveTabId: archiveTab.id,
            archiveName: archiveTab.fileData.name,
            entryPaths: entries.map((entry) => entry.path),
            suggestedName,
            errorMessage:
              entries.length === 1
                ? "That password did not unlock this archive entry. Try another password."
                : "That password did not unlock one or more selected archive entries. Try another password.",
          });
          return;
        }

        window.alert(getErrorMessage(error));
      }
    },
    [saveBytesAsFile, saveArchiveEntriesToDirectory]
  );

  const exportArchiveEntries = useCallback(
    (
      archiveTab: Tab,
      entries: ArchiveEntrySummary[],
      suggestedName?: string | null
    ) => {
      if (!archiveTab.archiveData || entries.length === 0) return;

      const cachedPassword = entries.some((entry) => entry.encrypted)
        ? archivePasswordsRef.current[archiveTab.id]
        : undefined;

      if (entries.some((entry) => entry.encrypted) && !cachedPassword) {
        setArchivePasswordPrompt({
          action: "export",
          archiveTabId: archiveTab.id,
          archiveName: archiveTab.fileData.name,
          entryPaths: entries.map((entry) => entry.path),
          suggestedName,
          errorMessage: null,
        });
        return;
      }

      void exportArchiveEntriesWithPassword(
        archiveTab,
        entries,
        cachedPassword,
        suggestedName
      );
    },
    [exportArchiveEntriesWithPassword]
  );

  const exportArchiveEntry = useCallback(
    (archiveTab: Tab, entry: ArchiveEntrySummary) => {
      void exportArchiveEntries(archiveTab, [entry], getLeafName(entry.path));
    },
    [exportArchiveEntries]
  );

  const handleArchivePasswordSubmit = useCallback(
    (password: string) => {
      if (!archivePasswordPrompt) return;

      const archiveTab = tabs.find(
        (candidate) => candidate.id === archivePasswordPrompt.archiveTabId
      );
      const entries =
        archiveTab?.archiveData?.entries.filter(
          (candidate) =>
            !candidate.directory &&
            archivePasswordPrompt.entryPaths.includes(candidate.path)
        ) ?? [];

      if (!archiveTab || entries.length === 0) {
        setArchivePasswordPrompt(null);
        return;
      }

      const entry = entries[0];

      if (archivePasswordPrompt.action === "open" && (!entry || entry.directory)) {
        setArchivePasswordPrompt(null);
        return;
      }

      setArchivePasswordPrompt(null);
      if (archivePasswordPrompt.action === "export") {
        void exportArchiveEntriesWithPassword(
          archiveTab,
          entries,
          password,
          archivePasswordPrompt.suggestedName
        );
      } else if (entry) {
        void openArchiveEntryWithPassword(archiveTab, entry, password);
      }
    },
    [
      archivePasswordPrompt,
      tabs,
      openArchiveEntryWithPassword,
      exportArchiveEntriesWithPassword,
    ]
  );

  const handleOpen = useCallback(async () => {
    if ("showOpenFilePicker" in window) {
      try {
        const [handle] = await (window as unknown as { showOpenFilePicker: (opts?: object) => Promise<FileSystemFileHandle[]> }).showOpenFilePicker();
        const file = await handle.getFile();
        await loadFile(file, handle);
      } catch { /* cancelled */ }
    } else {
      fileInputRef.current?.click();
    }
  }, [loadFile]);

  const handleSave = useCallback(async () => {
    if (!activeTab) return;

    if (activeTab.archiveOrigin) {
      try {
        await saveBytesAsFile({
          name: activeTab.fileData.name,
          bytes: activeTab.currentBytes,
          mimeType: activeTab.fileData.mimeType,
        });
      } catch (error) {
        window.alert(getErrorMessage(error));
      }
      return;
    }

    if (activeTab.readOnly || activeTab.fileData.format === "archive") return;
    const effMode = getEffectiveMode(activeTab);

    if (activeTab.fileData.handle) {
      try {
        const writable = await (activeTab.fileData.handle as unknown as { createWritable: () => Promise<{ write: (d: unknown) => Promise<void>; close: () => Promise<void> }> }).createWritable();
        await writable.write(effMode === "binary" || activeTab.fileData.isBinary ? activeTab.currentBytes : activeTab.currentContent);
        await writable.close();
        updateTab(activeTab.id, { modified: false, originalContent: activeTab.currentContent });
      } catch { /* denied */ }
    } else {
      const blob = effMode === "binary" || activeTab.fileData.isBinary
        ? toBlob(activeTab.currentBytes)
        : new Blob([activeTab.currentContent], { type: "text/plain" });

      if ("showSaveFilePicker" in window) {
        try {
          const handle = await (window as unknown as { showSaveFilePicker: (opts?: object) => Promise<FileSystemFileHandle> }).showSaveFilePicker({ suggestedName: activeTab.fileData.name });
          const writable = await (handle as unknown as { createWritable: () => Promise<{ write: (d: unknown) => Promise<void>; close: () => Promise<void> }> }).createWritable();
          await writable.write(blob);
          await writable.close();
          updateTab(activeTab.id, { modified: false, originalContent: activeTab.currentContent, fileData: { ...activeTab.fileData, handle } });
        } catch { /* cancelled */ }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = activeTab.fileData.name; a.click();
        URL.revokeObjectURL(url);
        updateTab(activeTab.id, { modified: false });
      }
    }
  }, [activeTab, updateTab, saveBytesAsFile]);

  // ── Format / Minify ─────────────────────────────

  const handleFormat = useCallback(() => {
    if (!activeTab || activeTab.fileData.isBinary || activeTab.readOnly) return;
    let result = activeTab.currentContent;
    if (activeTab.fileData.format === "json") {
      const r = prettyPrintJSON(activeTab.currentContent);
      if (r.error) return;
      result = r.result;
    } else if (activeTab.fileData.format === "xml" || activeTab.fileData.format === "html") {
      result = prettyPrintXML(activeTab.currentContent);
    } else return;
    editorRef.current?.replaceContent(result);
  }, [activeTab]);

  const handleMinify = useCallback(() => {
    if (!activeTab || activeTab.fileData.isBinary || activeTab.readOnly) return;
    let result = activeTab.currentContent;
    if (activeTab.fileData.format === "json") {
      const r = minifyJSON(activeTab.currentContent);
      if (r.error) return;
      result = r.result;
    } else if (activeTab.fileData.format === "xml" || activeTab.fileData.format === "html") {
      result = minifyXML(activeTab.currentContent);
    } else return;
    editorRef.current?.replaceContent(result);
  }, [activeTab]);

  // ── Diff ────────────────────────────────────────

  const handleCompareWithSaved = useCallback(async () => {
    if (!activeTab || activeTab.readOnly) return;
    if (activeTab.fileData.handle) {
      try {
        const file = await activeTab.fileData.handle.getFile();
        const text = await file.text();
        updateTab(activeTab.id, { originalContent: text });
      } catch { /* use stored original */ }
    }
    setShowDiff(true);
  }, [activeTab, updateTab]);

  // ── Line endings ────────────────────────────────

  const handleConvertLineEndings = useCallback((to: "LF" | "CRLF") => {
    if (!activeTab || activeTab.fileData.isBinary || activeTab.readOnly) return;
    const converted = convertLineEnding(activeTab.currentContent, to);
    editorRef.current?.replaceContent(converted);
  }, [activeTab]);

  // ── Encoding ────────────────────────────────────

  const handleChangeEncoding = useCallback((enc: string) => {
    if (!activeTab) return;
    const newText = decodeWithEncoding(activeTab.currentBytes, enc);
    updateTab(activeTab.id, { encoding: enc, currentContent: newText });
  }, [activeTab, updateTab]);

  // ── Settings ────────────────────────────────────

  const handleSettingsChange = useCallback((s: Settings) => {
    setSettings(s);
    saveSettings(s);
  }, []);

  // ── Keyboard shortcuts ──────────────────────────

  const keyboardHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});

  keyboardHandlerRef.current = (e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === "o") { e.preventDefault(); handleOpen(); }
    if (mod && e.key === "s") { e.preventDefault(); handleSave(); }
    if (mod && e.key === "w") { e.preventDefault(); if (activeTabId) closeTab(activeTabId); }
    if (mod && e.key === "g") { e.preventDefault(); if (activeTab && !activeTab.fileData.isBinary) setShowGoToLine(true); }
    if (mod && e.shiftKey && e.key === "P") { e.preventDefault(); setShowCommandPalette(true); }
    if (mod && e.shiftKey && e.key === "F") { e.preventDefault(); setShowGlobalSearch(true); }
    if (!mod && !e.shiftKey && e.key === "?" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.closest?.(".cm-editor"))) {
      e.preventDefault(); setShowShortcuts((v) => !v);
    }
    if (mod && e.key === "]") {
      e.preventDefault();
      if (tabs.length >= 2 && activeTabId) {
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        switchTab(tabs[(idx + 1) % tabs.length].id);
      }
    }
    if (mod && e.key === "[") {
      e.preventDefault();
      if (tabs.length >= 2 && activeTabId) {
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        switchTab(tabs[(idx - 1 + tabs.length) % tabs.length].id);
      }
    }
    if (mod && !e.shiftKey && e.key >= "1" && e.key <= "9") {
      e.preventDefault();
      const idx = parseInt(e.key) - 1;
      if (idx < tabs.length) switchTab(tabs[idx].id);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => keyboardHandlerRef.current(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Global drag-and-drop ────────────────────────

  useEffect(() => {
    let dragCount = 0;
    const onEnter = (e: DragEvent) => { e.preventDefault(); dragCount++; setIsDragging(true); };
    const onLeave = (e: DragEvent) => { e.preventDefault(); dragCount--; if (dragCount <= 0) { dragCount = 0; setIsDragging(false); } };
    const onOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault(); dragCount = 0; setIsDragging(false);
      const file = e.dataTransfer?.files[0];
      if (file) loadFile(file, null);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => { window.removeEventListener("dragenter", onEnter); window.removeEventListener("dragleave", onLeave); window.removeEventListener("dragover", onOver); window.removeEventListener("drop", onDrop); };
  }, [loadFile]);

  // ── Command Palette commands ────────────────────

  const commands: Command[] = useMemo(() => {
    const cmds: Command[] = [
      { id: "open", label: "Open File", shortcut: "⌘O", action: handleOpen },
    ];
    if (canSaveTab(activeTab)) {
      cmds.push({
        id: "save",
        label: getSaveActionLabel(activeTab),
        shortcut: "⌘S",
        action: handleSave,
      });
    }
    if (activeTab) {
      cmds.push(
        { id: "close", label: "Close Tab", shortcut: "⌘W", action: () => closeTab(activeTab.id) },
        { id: "closeAll", label: "Close All Tabs", action: closeAllTabs },
      );
    }
    cmds.push(
      { id: "search-files", label: "Search Across Open Files", shortcut: "⌘⇧F", action: () => setShowGlobalSearch(true) },
      { id: "theme", label: `Theme: ${themePreference} (cycle to ${themePreference === "auto" ? "light" : themePreference === "light" ? "dark" : "auto"})`, action: toggleTheme },
      { id: "settings", label: "Open Settings", action: () => setShowSettings(true) },
      { id: "shortcuts", label: "Keyboard Shortcuts", shortcut: "?", action: () => setShowShortcuts(true) },
    );
    if (activeTab && !activeTab.fileData.isBinary) {
      cmds.push(
        { id: "goto", label: "Go to Line", shortcut: "⌘G", action: () => setShowGoToLine(true) },
        { id: "wordwrap", label: `${settings.wordWrap ? "Disable" : "Enable"} Word Wrap`, action: () => handleSettingsChange({ ...settings, wordWrap: !settings.wordWrap }) },
        { id: "minimap", label: `${settings.minimap ? "Hide" : "Show"} Minimap`, action: () => handleSettingsChange({ ...settings, minimap: !settings.minimap }) },
        { id: "linenums", label: `${settings.lineNumbers ? "Hide" : "Show"} Line Numbers`, action: () => handleSettingsChange({ ...settings, lineNumbers: !settings.lineNumbers }) },
      );
      if (!activeTab.readOnly && (activeTab.fileData.format === "json" || activeTab.fileData.format === "xml" || activeTab.fileData.format === "html")) {
        cmds.push(
          { id: "format", label: "Format Document (Pretty Print)", section: "Format", action: handleFormat },
          { id: "minify", label: "Minify Document", section: "Format", action: handleMinify },
        );
      }
      if (activeTab.fileData.format === "markdown") {
        cmds.push({ id: "mdpreview", label: "Toggle Markdown Preview", action: () => {
          const modes: MarkdownMode[] = ["edit", "split", "preview"];
          const curr = modes.indexOf(activeTab.markdownMode);
          updateTab(activeTab.id, { markdownMode: modes[(curr + 1) % modes.length] });
        }});
      }
      if (!activeTab.readOnly) {
        cmds.push(
          { id: "diff", label: "Compare with Saved", action: handleCompareWithSaved },
          { id: "lf", label: "Convert Line Endings to LF", section: "Line Endings", action: () => handleConvertLineEndings("LF") },
          { id: "crlf", label: "Convert Line Endings to CRLF", section: "Line Endings", action: () => handleConvertLineEndings("CRLF") },
        );
      }
      for (const enc of SUPPORTED_ENCODINGS) {
        cmds.push({ id: `enc-${enc}`, label: `Reopen as ${enc.toUpperCase()}`, section: "Encoding", action: () => handleChangeEncoding(enc) });
      }
    }
    return cmds;
  }, [activeTab, themePreference, settings, handleOpen, handleSave, closeTab, closeAllTabs, toggleTheme, handleFormat, handleMinify, handleCompareWithSaved, handleConvertLineEndings, handleChangeEncoding, handleSettingsChange, updateTab]);

  // ── Derived state ───────────────────────────────

  const lineEnding: LineEnding | null = activeTab && !activeTab.fileData.isBinary ? detectLineEnding(activeTab.currentContent) : null;
  const tabInfos: TabInfo[] = tabs.map((t) => ({ id: t.id, name: t.fileData.name, modified: t.modified }));
  const searchableTabs: SearchableTab[] = useMemo(
    () => tabs.filter((t) => !t.fileData.isBinary).map((t) => ({ id: t.id, name: t.fileData.name, content: t.currentContent })),
    [tabs]
  );

  const handleSearchSelect = useCallback((tabId: string, lineNumber: number) => {
    switchTab(tabId);
    requestAnimationFrame(() => {
      editorRef.current?.goToLine(lineNumber);
    });
  }, [switchTab]);

  // ── Render ──────────────────────────────────────

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: "var(--sh-bg)", color: "var(--sh-text)" }}>
      <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f, null); }} />

      {tabs.length === 0 ? (
        <LandingPage
          onFile={loadFile}
          onOpenPicker={handleOpen}
          themePreference={themePreference}
          onToggleTheme={toggleTheme}
          recentFiles={recentFiles}
          onClearRecent={() => { clearRecentFiles(); setRecentFiles([]); }}
        />
      ) : (
        <>
          <TabBar tabs={tabInfos} activeId={activeTabId} onSelect={switchTab} onClose={closeTab} onNewTab={handleOpen} onReorder={reorderTabs} />
          {activeTab && <ActiveTabView
            key={activeTab.id}
            tab={activeTab}
            theme={theme}
            themePreference={themePreference}
            settings={settings}
            cursorPos={cursorPos}
            lineEnding={lineEnding}
            editorRef={editorRef}
            editorSnapshot={editorSnapshotsRef.current[activeTab.id] ?? null}
            onToggleTheme={toggleTheme}
            onUpdateTab={updateTab}
            onOpen={handleOpen}
            onSave={handleSave}
            onClose={() => closeTab(activeTab.id)}
            onCursorChange={setCursorPos}
            onFormat={handleFormat}
            onOpenArchiveEntry={openArchiveEntry}
            onExportArchiveEntry={exportArchiveEntry}
            onExportArchiveEntries={exportArchiveEntries}
            onShowCommands={() => setShowCommandPalette(true)}
            onShowShortcuts={() => setShowShortcuts(true)}
          />}
        </>
      )}

      {isDragging && tabs.length > 0 && <DragOverlay />}
      {showCommandPalette && <CommandPalette commands={commands} onClose={() => setShowCommandPalette(false)} />}
      {showSettings && <SettingsPanel settings={settings} onChange={handleSettingsChange} onClose={() => setShowSettings(false)} />}
      {showGoToLine && activeTab && (
        <GoToLine
          totalLines={countLines(activeTab.currentContent)}
          onGo={(line) => editorRef.current?.goToLine(line)}
          onClose={() => setShowGoToLine(false)}
        />
      )}
      {showDiff && activeTab && (
        <DiffView
          original={activeTab.originalContent}
          modified={activeTab.currentContent}
          fileName={activeTab.fileData.name}
          onClose={() => setShowDiff(false)}
        />
      )}
      {showShortcuts && <ShortcutGuide onClose={() => setShowShortcuts(false)} />}
      {showGlobalSearch && (
        <GlobalSearch
          tabs={searchableTabs}
          onSelectMatch={handleSearchSelect}
          onClose={() => setShowGlobalSearch(false)}
        />
      )}
      {testMode.enabled && (
        <TestFixturePanel
          fixtures={testFixtures}
          loading={testFixturesLoading}
          onLoad={loadTestFixture}
        />
      )}
      {archivePasswordPrompt && (
        <PasswordPrompt
          title="Archive password required"
          description={getArchivePasswordPromptDescription(archivePasswordPrompt)}
          errorMessage={archivePasswordPrompt.errorMessage}
          submitLabel={getArchivePasswordSubmitLabel(archivePasswordPrompt)}
          onSubmit={handleArchivePasswordSubmit}
          onClose={() => setArchivePasswordPrompt(null)}
        />
      )}
    </div>
  );
}

// ── Active Tab View ─────────────────────────────────────────

function getEffectiveMode(tab: Tab): EffectiveViewMode {
  if (tab.viewMode === "archive" && tab.archiveData) return "archive";
  if (tab.viewMode === "display") return "display";
  if (tab.viewMode === "text") return "text";
  if (tab.viewMode === "binary") return "binary";
  if (tab.fileData.format === "archive" && tab.archiveData) return "archive";
  if (shouldAutoDisplay(tab.fileData.name, tab.fileData.mimeType, tab.fileData.format)) return "display";
  if (tab.fileData.isBinary) return "binary";
  return "text";
}

function ActiveTabView({ tab, theme, themePreference, settings, cursorPos, lineEnding, editorRef, editorSnapshot, onToggleTheme, onUpdateTab, onOpen, onSave, onClose, onCursorChange, onFormat, onOpenArchiveEntry, onExportArchiveEntry, onExportArchiveEntries, onShowCommands, onShowShortcuts }: {
  tab: Tab;
  theme: ResolvedTheme;
  themePreference: ThemePreference;
  settings: Settings;
  cursorPos: { line: number; col: number };
  lineEnding: LineEnding | null;
  editorRef: React.RefObject<CodeEditorRef | null>;
  editorSnapshot: EditorSnapshot | null;
  onToggleTheme: () => void;
  onUpdateTab: (id: string, patch: Partial<Tab>) => void;
  onOpen: () => void;
  onSave: () => void;
  onClose: () => void;
  onCursorChange: (pos: { line: number; col: number }) => void;
  onFormat: () => void;
  onOpenArchiveEntry: (archiveTab: Tab, entry: ArchiveEntrySummary) => void;
  onExportArchiveEntry: (archiveTab: Tab, entry: ArchiveEntrySummary) => void;
  onExportArchiveEntries: (
    archiveTab: Tab,
    entries: ArchiveEntrySummary[],
    suggestedName?: string | null
  ) => void;
  onShowCommands: () => void;
  onShowShortcuts: () => void;
}) {
  const mode = getEffectiveMode(tab);
  const canFormat = (tab.fileData.format === "json" || tab.fileData.format === "xml" || tab.fileData.format === "html") && !tab.fileData.isBinary && !tab.readOnly;
  const isMarkdown = tab.fileData.format === "markdown" && mode === "text";
  const viewModes =
    tab.fileData.format === "archive"
      ? (["auto", "archive", "binary"] as const)
      : (["auto", "display", "text", "binary"] as const);
  const archiveFileCount = tab.archiveData
    ? tab.archiveData.entries.filter((entry) => !entry.directory).length
    : 0;
  const sourceLabel = tab.archiveOrigin
    ? "archive"
    : tab.fileData.handle
      ? "local"
      : "buffer";

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center h-10 px-3 gap-2 shrink-0 select-none" style={{ backgroundColor: "var(--sh-bg2)", borderBottom: "1px solid var(--sh-border)" }}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs px-1.5 py-0.5 rounded font-mono shrink-0" style={{ backgroundColor: "var(--sh-bg-active)", color: "var(--sh-accent-green)" }}>
            {formatLabel(tab.fileData.format)}
          </span>
          <span className="text-sm truncate font-mono" style={{ color: "var(--sh-text)" }} title={tab.fileData.name}>{tab.fileData.name}</span>
          {tab.readOnly && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0"
              style={{ backgroundColor: "var(--sh-bg-active)", color: "var(--sh-text2)" }}
              title={tab.readOnlyReason ?? undefined}
            >
              read-only
            </span>
          )}
          {tab.modified && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "var(--sh-accent-yellow)" }} />}
        </div>
        <div className="flex items-center gap-1">
          {/* View mode toggle */}
          <div className="flex rounded-md overflow-hidden mr-1" style={{ border: "1px solid var(--sh-bg-active)" }}>
            {viewModes.map((m) => (
              <button key={m} onClick={() => onUpdateTab(tab.id, { viewMode: m })}
                className="px-2 py-1 text-xs font-medium transition-colors"
                style={{ backgroundColor: tab.viewMode === m ? "var(--sh-bg-active)" : "transparent", color: tab.viewMode === m ? "var(--sh-text)" : "var(--sh-text2)" }}>
                {VIEW_MODE_LABELS[m]}
              </button>
            ))}
          </div>
          {/* Markdown mode toggle */}
          {isMarkdown && (
            <div className="flex rounded-md overflow-hidden mr-1" style={{ border: "1px solid var(--sh-bg-active)" }}>
              {(["edit", "split", "preview"] as MarkdownMode[]).map((m) => (
                <button key={m} onClick={() => onUpdateTab(tab.id, { markdownMode: m })}
                  className="px-2 py-1 text-xs font-medium transition-colors"
                  style={{ backgroundColor: tab.markdownMode === m ? "var(--sh-bg-active)" : "transparent", color: tab.markdownMode === m ? "var(--sh-text)" : "var(--sh-text2)" }}>
                  {m === "edit" ? "Edit" : m === "split" ? "Split" : "Preview"}
                </button>
              ))}
            </div>
          )}
          {canFormat && (
            <TBtn onClick={onFormat} title="Format document">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="21" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="21" y1="18" x2="3" y2="18" />
              </svg>
            </TBtn>
          )}
          <TBtn onClick={onOpen} title="Open file (⌘O)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
          </TBtn>
          <TBtn onClick={onSave} title={getSaveActionTitle(tab)} accent={tab.modified && !tab.readOnly} disabled={!canSaveTab(tab)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
          </TBtn>
          <TBtn onClick={onShowCommands} title="Command Palette (⌘⇧P)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
          </TBtn>
          <TBtn onClick={onShowShortcuts} title="Keyboard Shortcuts (?)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
          </TBtn>
          <TBtn onClick={onToggleTheme} title={`Theme: ${themePreference} (click to cycle)`}>
            {themePreference === "auto" ? <AutoThemeIcon /> : themePreference === "dark" ? <SunIcon /> : <MoonIcon />}
          </TBtn>
          <TBtn onClick={onClose} title="Close tab">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </TBtn>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-hidden relative">
        {mode === "archive" ? (
          tab.archiveData ? (
            <ArchiveBrowser
              key={tab.id}
              archive={tab.archiveData}
              archiveName={tab.fileData.name}
              onOpenEntry={(entry) => onOpenArchiveEntry(tab, entry)}
              onExportEntry={(entry) => onExportArchiveEntry(tab, entry)}
              onExportEntries={(entries, suggestedName) =>
                onExportArchiveEntries(tab, entries, suggestedName)
              }
            />
          ) : (
            <div className="flex h-full items-center justify-center" style={{ color: "var(--sh-text2)" }}>
              <p className="text-sm">This archive could not be browsed.</p>
            </div>
          )
        ) : mode === "display" ? (
          <DisplayViewer
            name={tab.fileData.name}
            format={tab.fileData.format}
            mimeType={tab.fileData.mimeType}
            content={tab.currentContent}
            bytes={tab.currentBytes}
            isBinary={tab.fileData.isBinary}
          />
        ) : mode === "binary" ? (
          <HexViewer bytes={tab.currentBytes} readOnly={tab.readOnly} onChange={(bytes) => onUpdateTab(tab.id, { currentBytes: bytes, modified: true })} />
        ) : isMarkdown && tab.markdownMode === "preview" ? (
          <MarkdownPreview content={tab.currentContent} />
        ) : isMarkdown && tab.markdownMode === "split" ? (
          <div className="flex h-full">
            <div className="flex-1 overflow-hidden" style={{ borderRight: "1px solid var(--sh-border)" }}>
              <CodeEditor ref={editorRef} content={tab.currentContent} format={tab.fileData.format} theme={theme}
                wordWrap={settings.wordWrap} fontSize={settings.fontSize} tabSize={settings.tabSize}
                showLineNumbers={settings.lineNumbers} showMinimap={settings.minimap}
                readOnly={tab.readOnly}
                initialSnapshot={editorSnapshot}
                onChange={(c) => onUpdateTab(tab.id, { currentContent: c, modified: true })}
                onCursorChange={(l, c) => onCursorChange({ line: l, col: c })} />
            </div>
            <div className="flex-1 overflow-hidden">
              <MarkdownPreview content={tab.currentContent} />
            </div>
          </div>
        ) : (
          <CodeEditor ref={editorRef} content={tab.currentContent} format={tab.fileData.format} theme={theme}
            wordWrap={settings.wordWrap} fontSize={settings.fontSize} tabSize={settings.tabSize}
            showLineNumbers={settings.lineNumbers} showMinimap={settings.minimap}
            readOnly={tab.readOnly}
            initialSnapshot={editorSnapshot}
            onChange={(c) => onUpdateTab(tab.id, { currentContent: c, modified: true })}
            onCursorChange={(l, c) => onCursorChange({ line: l, col: c })} />
        )}
        {/* Go to line overlay (positioned over editor) */}
      </div>

      {/* Status bar */}
      <div className="flex items-center h-6 px-3 text-[11px] gap-4 shrink-0 select-none font-mono" style={{ backgroundColor: "var(--sh-bg2)", borderTop: "1px solid var(--sh-border)", color: "var(--sh-text2)" }}>
        <span>{formatBytes(tab.fileData.size)}</span>
        {!tab.fileData.isBinary && <span>{countLines(tab.currentContent).toLocaleString()} lines</span>}
        {tab.archiveData && <span>{archiveFileCount.toLocaleString()} files</span>}
        {mode !== "archive" && <span className="cursor-help" title="Encoding">{tab.encoding}</span>}
        <span>{mode === "archive" ? "archive" : mode === "display" ? "display" : mode === "binary" ? "binary" : formatLabel(tab.fileData.format).toLowerCase()}</span>
        {tab.readOnly && <span title={tab.readOnlyReason ?? undefined}>read-only</span>}
        {lineEnding && <span className="cursor-help" title="Line endings">{lineEnding}</span>}
        {tab.archiveOrigin && <span title={tab.archiveOrigin.archiveName}>from {tab.archiveOrigin.archiveName}</span>}
        {mode === "text" && <span className="ml-auto">Ln {cursorPos.line}, Col {cursorPos.col}</span>}
        <span className={mode === "text" ? "" : "ml-auto"}>{sourceLabel}</span>
      </div>
    </>
  );
}
