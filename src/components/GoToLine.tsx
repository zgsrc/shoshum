"use client";

import { useState, useEffect, useRef } from "react";

interface GoToLineProps {
  totalLines: number;
  onGo: (line: number) => void;
  onClose: () => void;
}

export default function GoToLine({ totalLines, onGo, onClose }: GoToLineProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1 && num <= totalLines) {
      onGo(num);
      onClose();
    }
  };

  return (
    <div
      className="absolute top-0 left-1/2 -translate-x-1/2 z-40 mt-1 rounded-lg shadow-lg overflow-hidden"
      style={{ backgroundColor: "var(--sh-bg2)", border: "1px solid var(--sh-border)" }}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-xs whitespace-nowrap" style={{ color: "var(--sh-text2)" }}>
          Go to Line
        </span>
        <input
          ref={inputRef}
          type="text"
          className="w-24 h-7 px-2 rounded text-sm font-mono outline-none"
          style={{
            backgroundColor: "var(--sh-bg)",
            color: "var(--sh-text)",
            border: "1px solid var(--sh-bg-active)",
          }}
          placeholder={`1–${totalLines}`}
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onClose();
          }}
        />
        <button
          className="h-7 px-3 rounded text-xs font-medium text-white"
          style={{ backgroundColor: "var(--sh-accent-blue)" }}
          onClick={handleSubmit}
        >
          Go
        </button>
      </div>
    </div>
  );
}
