"use client";

import { useEffect, useRef } from "react";

interface ShortcutGuideProps {
  onClose: () => void;
}

const SECTIONS: { title: string; shortcuts: { keys: string; label: string }[] }[] = [
  {
    title: "File",
    shortcuts: [
      { keys: "⌘ O", label: "Open file" },
      { keys: "⌘ S", label: "Save file" },
      { keys: "⌘ W", label: "Close tab" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: "⌘ G", label: "Go to line" },
      { keys: "⌘ 1–9", label: "Switch to tab" },
      { keys: "⌘ ]", label: "Next tab" },
      { keys: "⌘ [", label: "Previous tab" },
    ],
  },
  {
    title: "Editor",
    shortcuts: [
      { keys: "⌘ Z", label: "Undo" },
      { keys: "⌘ ⇧ Z", label: "Redo" },
      { keys: "⌘ F", label: "Find" },
      { keys: "⌘ H", label: "Find & replace" },
      { keys: "⌘ D", label: "Select next occurrence" },
      { keys: "Tab", label: "Indent" },
      { keys: "⇧ Tab", label: "Outdent" },
    ],
  },
  {
    title: "View",
    shortcuts: [
      { keys: "⌘ ⇧ P", label: "Command palette" },
      { keys: "⌘ ⇧ F", label: "Search across files" },
      { keys: "?", label: "Keyboard shortcuts" },
    ],
  },
];

export default function ShortcutGuide({ onClose }: ShortcutGuideProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="w-full max-w-[540px] rounded-lg shadow-2xl overflow-hidden"
        style={{ backgroundColor: "var(--sh-bg2)", border: "1px solid var(--sh-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between h-11 px-5"
          style={{ borderBottom: "1px solid var(--sh-border)" }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--sh-text)" }}>
            Keyboard Shortcuts
          </span>
          <button
            className="p-1 rounded transition-colors"
            style={{ color: "var(--sh-text-muted)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--sh-bg-hover)";
              e.currentTarget.style.color = "var(--sh-text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--sh-text-muted)";
            }}
            onClick={onClose}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-5 grid grid-cols-2 gap-6 max-h-[70vh] overflow-auto">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h3
                className="text-[11px] font-semibold uppercase tracking-wider mb-2.5"
                style={{ color: "var(--sh-text-muted)" }}
              >
                {section.title}
              </h3>
              <div className="space-y-1.5">
                {section.shortcuts.map((s) => (
                  <div key={s.keys} className="flex items-center justify-between gap-3">
                    <span className="text-[13px]" style={{ color: "var(--sh-text2)" }}>
                      {s.label}
                    </span>
                    <Kbd keys={s.keys} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div
          className="flex items-center justify-center h-9 text-[11px]"
          style={{ borderTop: "1px solid var(--sh-border)", color: "var(--sh-text-muted)" }}
        >
          Press <Kbd keys="?" /> to toggle &nbsp;·&nbsp; <Kbd keys="Esc" /> to close
        </div>
      </div>
    </div>
  );
}

function Kbd({ keys }: { keys: string }) {
  const parts = keys.split(" ");
  return (
    <span className="flex items-center gap-0.5 shrink-0">
      {parts.map((part, i) => (
        <kbd
          key={i}
          className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded text-[11px] font-mono leading-none"
          style={{
            backgroundColor: "var(--sh-bg)",
            color: "var(--sh-text)",
            border: "1px solid var(--sh-bg-active)",
            boxShadow: "0 1px 0 var(--sh-bg-active)",
          }}
        >
          {part}
        </kbd>
      ))}
    </span>
  );
}
