"use client";

interface PreviewMessageProps {
  title: string;
  body: string;
}

export default function PreviewMessage({ title, body }: PreviewMessageProps) {
  return (
    <div
      className="flex h-full w-full items-center justify-center p-6"
      style={{ backgroundColor: "var(--sh-bg)" }}
    >
      <div
        className="max-w-md rounded-xl px-6 py-5 text-center"
        style={{
          backgroundColor: "var(--sh-bg2)",
          border: "1px solid var(--sh-border)",
        }}
      >
        <h2 className="mb-2 text-sm font-semibold" style={{ color: "var(--sh-text)" }}>
          {title}
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: "var(--sh-text2)" }}>
          {body}
        </p>
      </div>
    </div>
  );
}
