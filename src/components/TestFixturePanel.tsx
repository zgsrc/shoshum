"use client";

import type { TestFixtureId } from "@/lib/testFixtures";

interface TestFixtureSummary {
  id: TestFixtureId;
  label: string;
  description: string;
  password: string;
}

interface TestFixturePanelProps {
  fixtures: readonly TestFixtureSummary[];
  loading: boolean;
  onLoad: (id: TestFixtureId) => void;
}

export default function TestFixturePanel({
  fixtures,
  loading,
  onLoad,
}: TestFixturePanelProps) {
  return (
    <div
      className="fixed right-4 bottom-4 z-30 w-full max-w-xs rounded-lg shadow-2xl overflow-hidden"
      style={{ backgroundColor: "var(--sh-bg2)", border: "1px solid var(--sh-border)" }}
    >
      <div
        className="px-4 py-3"
        style={{ borderBottom: "1px solid var(--sh-border)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium" style={{ color: "var(--sh-text)" }}>
              Test Mode
            </h2>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--sh-text2)" }}>
              Load encrypted fixtures without the native file picker.
            </p>
          </div>
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-mono"
            style={{
              color: "var(--sh-accent-blue)",
              backgroundColor: "var(--sh-bg)",
              border: "1px solid var(--sh-border)",
            }}
          >
            ?testMode=1
          </span>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {loading ? (
          <p className="text-xs" style={{ color: "var(--sh-text2)" }}>
            Loading fixtures...
          </p>
        ) : (
          fixtures.map((fixture) => (
            <div
              key={fixture.id}
              className="rounded-md p-3"
              style={{ backgroundColor: "var(--sh-bg)", border: "1px solid var(--sh-border)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium" style={{ color: "var(--sh-text)" }}>
                    {fixture.label}
                  </div>
                  <div className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--sh-text2)" }}>
                    {fixture.description}
                  </div>
                  <div className="mt-2 text-[11px] font-mono" style={{ color: "var(--sh-text-muted)" }}>
                    Password: {fixture.password}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onLoad(fixture.id)}
                  className="rounded px-2.5 py-1.5 text-[11px] text-white shrink-0 transition-colors"
                  style={{ backgroundColor: "var(--sh-btn-green)" }}
                >
                  Load
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
