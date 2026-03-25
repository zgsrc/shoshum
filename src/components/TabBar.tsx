"use client";

import { useRef, useEffect } from "react";

export interface TabInfo {
  id: string;
  name: string;
  modified: boolean;
}

interface TabBarProps {
  tabs: TabInfo[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNewTab: () => void;
}

export default function TabBar({ tabs, activeId, onSelect, onClose, onNewTab }: TabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId]);

  return (
    <div
      className="flex items-center h-9 shrink-0 select-none"
      style={{ backgroundColor: "var(--sh-bg2)", borderBottom: "1px solid var(--sh-border)" }}
    >
      <div ref={scrollRef} className="flex items-center flex-1 overflow-x-auto min-w-0 scrollbar-none">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              ref={isActive ? activeRef : null}
              className="flex items-center gap-1.5 h-9 px-3 text-xs font-mono shrink-0 border-r transition-colors group"
              style={{
                backgroundColor: isActive ? "var(--sh-bg)" : "transparent",
                color: isActive ? "var(--sh-text)" : "var(--sh-text2)",
                borderColor: "var(--sh-border)",
                borderBottom: isActive ? "1px solid var(--sh-bg)" : "1px solid var(--sh-border)",
                marginBottom: "-1px",
              }}
              onClick={() => onSelect(tab.id)}
            >
              <span className="truncate max-w-[140px]">{tab.name}</span>
              {tab.modified && (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: "var(--sh-accent-yellow)" }}
                />
              )}
              <span
                className="ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "var(--sh-text-muted)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--sh-bg-hover)";
                  e.currentTarget.style.color = "var(--sh-text)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "var(--sh-text-muted)";
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </span>
            </button>
          );
        })}
      </div>
      <button
        className="flex items-center justify-center w-9 h-9 shrink-0 transition-colors"
        style={{ color: "var(--sh-text-muted)" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--sh-text)";
          e.currentTarget.style.backgroundColor = "var(--sh-bg-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--sh-text-muted)";
          e.currentTarget.style.backgroundColor = "transparent";
        }}
        onClick={onNewTab}
        title="Open file"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
