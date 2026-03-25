"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";

export interface SearchableTab {
  id: string;
  name: string;
  content: string;
}

interface SearchMatch {
  tabId: string;
  tabName: string;
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
}

interface GlobalSearchProps {
  tabs: SearchableTab[];
  onSelectMatch: (tabId: string, lineNumber: number) => void;
  onClose: () => void;
}

const MAX_RESULTS = 200;

export default function GlobalSearch({ tabs, onSelectMatch, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const matches = useMemo((): SearchMatch[] => {
    if (!query) return [];
    const results: SearchMatch[] = [];

    let pattern: RegExp | null = null;
    if (useRegex) {
      try {
        pattern = new RegExp(query, caseSensitive ? "g" : "gi");
      } catch {
        return [];
      }
    }

    for (const tab of tabs) {
      if (!tab.content) continue;
      const lines = tab.content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (pattern) {
          pattern.lastIndex = 0;
          const m = pattern.exec(line);
          if (m) {
            results.push({
              tabId: tab.id,
              tabName: tab.name,
              lineNumber: i + 1,
              lineContent: line,
              matchStart: m.index,
              matchEnd: m.index + m[0].length,
            });
          }
        } else {
          const haystack = caseSensitive ? line : line.toLowerCase();
          const needle = caseSensitive ? query : query.toLowerCase();
          const idx = haystack.indexOf(needle);
          if (idx !== -1) {
            results.push({
              tabId: tab.id,
              tabName: tab.name,
              lineNumber: i + 1,
              lineContent: line,
              matchStart: idx,
              matchEnd: idx + needle.length,
            });
          }
        }

        if (results.length >= MAX_RESULTS) return results;
      }
    }

    return results;
  }, [query, tabs, caseSensitive, useRegex]);

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleSelect = useCallback((match: SearchMatch) => {
    onSelectMatch(match.tabId, match.lineNumber);
    onClose();
  }, [onSelectMatch, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (matches[selectedIndex]) handleSelect(matches[selectedIndex]);
    } else if (e.key === "Escape") {
      onClose();
    }
  }, [matches, selectedIndex, handleSelect, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[640px] rounded-lg shadow-2xl overflow-hidden"
        style={{ backgroundColor: "var(--sh-bg2)", border: "1px solid var(--sh-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-3 gap-2" style={{ borderBottom: "1px solid var(--sh-border)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sh-text-muted)" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            className="flex-1 h-10 bg-transparent text-sm outline-none font-mono"
            style={{ color: "var(--sh-text)" }}
            placeholder="Search across open files..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <button
            className="px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors"
            style={{
              backgroundColor: caseSensitive ? "var(--sh-accent-blue)" : "var(--sh-bg-active)",
              color: caseSensitive ? "#fff" : "var(--sh-text2)",
            }}
            onClick={() => {
              setCaseSensitive((v) => !v);
              setSelectedIndex(0);
            }}
            title="Case Sensitive"
          >
            Aa
          </button>
          <button
            className="px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors"
            style={{
              backgroundColor: useRegex ? "var(--sh-accent-blue)" : "var(--sh-bg-active)",
              color: useRegex ? "#fff" : "var(--sh-text2)",
            }}
            onClick={() => {
              setUseRegex((v) => !v);
              setSelectedIndex(0);
            }}
            title="Use Regular Expression"
          >
            .*
          </button>
        </div>
        <div ref={listRef} className="max-h-[400px] overflow-auto py-1">
          {query && matches.length === 0 && (
            <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--sh-text-muted)" }}>
              No matches found
            </div>
          )}
          {!query && (
            <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--sh-text-muted)" }}>
              Type to search across {tabs.length} open file{tabs.length !== 1 ? "s" : ""}
            </div>
          )}
          {matches.map((match, i) => (
            <button
              key={`${match.tabId}-${match.lineNumber}-${i}`}
              className="flex items-start w-full px-4 py-1.5 text-left text-xs transition-colors gap-2"
              style={{
                backgroundColor: i === selectedIndex ? "var(--sh-bg-hover)" : "transparent",
                color: "var(--sh-text)",
              }}
              onMouseEnter={() => setSelectedIndex(i)}
              onClick={() => handleSelect(match)}
            >
              <span
                className="shrink-0 truncate max-w-[140px] font-mono"
                style={{ color: "var(--sh-accent-blue)" }}
                title={match.tabName}
              >
                {match.tabName}
              </span>
              <span
                className="shrink-0 font-mono tabular-nums"
                style={{ color: "var(--sh-text-muted)", minWidth: "3ch" }}
              >
                {match.lineNumber}
              </span>
              <span className="truncate font-mono" style={{ color: "var(--sh-text2)" }}>
                {match.lineContent.slice(0, match.matchStart)}
                <span style={{ backgroundColor: "var(--sh-accent-yellow)", color: "#000", borderRadius: "2px", padding: "0 1px" }}>
                  {match.lineContent.slice(match.matchStart, match.matchEnd)}
                </span>
                {match.lineContent.slice(match.matchEnd)}
              </span>
            </button>
          ))}
          {matches.length >= MAX_RESULTS && (
            <div className="px-4 py-2 text-center text-xs" style={{ color: "var(--sh-text-muted)" }}>
              Showing first {MAX_RESULTS} results
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
