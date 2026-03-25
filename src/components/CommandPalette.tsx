"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  section?: string;
  action: () => void;
}

interface CommandPaletteProps {
  commands: Command[];
  onClose: () => void;
}

export default function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        (cmd.section && cmd.section.toLowerCase().includes(q))
    );
  }, [commands, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const run = useCallback(
    (cmd: Command) => {
      cmd.action();
      onClose();
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) run(filtered[selectedIndex]);
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [filtered, selectedIndex, run, onClose]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[520px] rounded-lg shadow-2xl overflow-hidden"
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
            placeholder="Type a command..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div ref={listRef} className="max-h-[320px] overflow-auto py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--sh-text-muted)" }}>
              No matching commands
            </div>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              className="flex items-center justify-between w-full px-4 py-2 text-left text-sm transition-colors"
              style={{
                backgroundColor: i === selectedIndex ? "var(--sh-bg-hover)" : "transparent",
                color: "var(--sh-text)",
              }}
              onMouseEnter={() => setSelectedIndex(i)}
              onClick={() => run(cmd)}
            >
              <div className="flex items-center gap-2 min-w-0">
                {cmd.section && (
                  <span className="text-xs shrink-0" style={{ color: "var(--sh-text-muted)" }}>
                    {cmd.section}
                  </span>
                )}
                <span className="truncate">{cmd.label}</span>
              </div>
              {cmd.shortcut && (
                <span
                  className="text-xs font-mono shrink-0 ml-4 px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: "var(--sh-bg-active)", color: "var(--sh-text2)" }}
                >
                  {cmd.shortcut}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
