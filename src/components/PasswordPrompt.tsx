"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";

interface PasswordPromptProps {
  title: string;
  description: string;
  errorMessage?: string | null;
  submitLabel?: string;
  onSubmit: (password: string) => void;
  onClose: () => void;
}

export default function PasswordPrompt({
  title,
  description,
  errorMessage = null,
  submitLabel = "Unlock",
  onSubmit,
  onClose,
}: PasswordPromptProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!value) return;
    onSubmit(value);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <form
        className="w-full max-w-sm rounded-lg shadow-2xl overflow-hidden"
        style={{ backgroundColor: "var(--sh-bg2)", border: "1px solid var(--sh-border)" }}
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div
          className="flex items-center justify-between h-11 px-5"
          style={{ borderBottom: "1px solid var(--sh-border)" }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--sh-text)" }}>
            {title}
          </span>
          <button
            type="button"
            className="p-1 rounded transition-colors"
            style={{ color: "var(--sh-text-muted)" }}
            onMouseEnter={(event) => {
              event.currentTarget.style.backgroundColor = "var(--sh-bg-hover)";
              event.currentTarget.style.color = "var(--sh-text)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = "transparent";
              event.currentTarget.style.color = "var(--sh-text-muted)";
            }}
            onClick={onClose}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm leading-relaxed" style={{ color: "var(--sh-text2)" }}>
            {description}
          </p>

          {errorMessage && (
            <div
              className="mt-3 rounded-md px-3 py-2 text-sm"
              style={{
                backgroundColor: "color-mix(in srgb, var(--sh-accent-yellow) 12%, var(--sh-bg2))",
                border: "1px solid color-mix(in srgb, var(--sh-accent-yellow) 35%, var(--sh-border))",
                color: "var(--sh-text)",
              }}
            >
              {errorMessage}
            </div>
          )}

          <input
            ref={inputRef}
            type="password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
            className="mt-4 w-full rounded-md px-3 py-2 text-sm outline-none"
            style={{
              color: "var(--sh-text)",
              backgroundColor: "var(--sh-bg)",
              border: "1px solid var(--sh-border)",
            }}
          />
        </div>

        <div
          className="flex items-center justify-end gap-2 px-5 py-4"
          style={{ borderTop: "1px solid var(--sh-border)" }}
        >
          <button
            type="button"
            className="rounded px-3 py-1.5 text-sm transition-colors"
            style={{
              backgroundColor: "transparent",
              border: "1px solid var(--sh-border)",
              color: "var(--sh-text2)",
            }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!value}
            className="rounded px-3 py-1.5 text-sm text-white transition-colors disabled:cursor-default disabled:opacity-50"
            style={{ backgroundColor: "var(--sh-btn-green)" }}
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
