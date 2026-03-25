"use client";

import { type Settings, getDefaults } from "@/lib/settings";

interface SettingsPanelProps {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onClose: () => void;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className="relative w-9 h-5 rounded-full transition-colors"
      style={{ backgroundColor: checked ? "var(--sh-accent-blue)" : "var(--sh-bg-active)" }}
      onClick={() => onChange(!checked)}
    >
      <span
        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform bg-white"
        style={{ transform: checked ? "translateX(16px)" : "translateX(0)" }}
      />
    </button>
  );
}

function NumberStepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        className="w-6 h-6 rounded flex items-center justify-center text-sm transition-colors"
        style={{ backgroundColor: "var(--sh-bg-active)", color: "var(--sh-text)" }}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        -
      </button>
      <span
        className="w-8 text-center text-sm font-mono"
        style={{ color: "var(--sh-text)" }}
      >
        {value}
      </span>
      <button
        className="w-6 h-6 rounded flex items-center justify-center text-sm transition-colors"
        style={{ backgroundColor: "var(--sh-bg-active)", color: "var(--sh-text)" }}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
}

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: number }[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex rounded-md overflow-hidden" style={{ border: "1px solid var(--sh-bg-active)" }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className="px-3 py-1 text-xs font-medium transition-colors"
          style={{
            backgroundColor: value === opt.value ? "var(--sh-bg-active)" : "transparent",
            color: value === opt.value ? "var(--sh-text)" : "var(--sh-text2)",
          }}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
  const update = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[400px] rounded-lg shadow-2xl"
        style={{ backgroundColor: "var(--sh-bg2)", border: "1px solid var(--sh-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between h-11 px-4"
          style={{ borderBottom: "1px solid var(--sh-border)" }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--sh-text)" }}>
            Settings
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

        <div className="p-4 space-y-4">
          <Row label="Font Size">
            <NumberStepper value={settings.fontSize} min={10} max={24} onChange={(v) => update({ fontSize: v })} />
          </Row>
          <Row label="Tab Size">
            <SegmentedControl
              options={[
                { label: "2", value: 2 },
                { label: "4", value: 4 },
                { label: "8", value: 8 },
              ]}
              value={settings.tabSize}
              onChange={(v) => update({ tabSize: v })}
            />
          </Row>
          <Row label="Word Wrap">
            <Toggle checked={settings.wordWrap} onChange={(v) => update({ wordWrap: v })} />
          </Row>
          <Row label="Minimap">
            <Toggle checked={settings.minimap} onChange={(v) => update({ minimap: v })} />
          </Row>
          <Row label="Line Numbers">
            <Toggle checked={settings.lineNumbers} onChange={(v) => update({ lineNumbers: v })} />
          </Row>
        </div>

        <div className="px-4 pb-4">
          <button
            className="w-full h-8 rounded text-xs font-medium transition-colors"
            style={{
              backgroundColor: "var(--sh-bg-hover)",
              color: "var(--sh-text2)",
              border: "1px solid var(--sh-border)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--sh-bg-active)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--sh-bg-hover)")}
            onClick={() => onChange(getDefaults())}
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm" style={{ color: "var(--sh-text2)" }}>
        {label}
      </span>
      {children}
    </div>
  );
}
