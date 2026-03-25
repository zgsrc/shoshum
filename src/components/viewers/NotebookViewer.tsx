"use client";

import { useMemo } from "react";
import { marked } from "marked";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import PreviewMessage from "./PreviewMessage";

interface NotebookCell {
  cell_type: "markdown" | "code" | "raw" | string;
  source?: string | string[];
  metadata?: Record<string, unknown>;
  execution_count?: number | null;
  outputs?: NotebookOutput[];
}

interface NotebookOutput {
  output_type?: string;
  name?: string;
  text?: string | string[];
  ename?: string;
  evalue?: string;
  traceback?: string[];
  data?: Record<string, string | string[]>;
}

interface NotebookDocument {
  metadata?: Record<string, unknown>;
  nbformat?: number;
  nbformat_minor?: number;
  cells?: NotebookCell[];
}

interface NotebookViewerProps {
  content: string;
  name: string;
}

export default function NotebookViewer({ content, name }: NotebookViewerProps) {
  const parsed = useMemo(() => {
    try {
      const document = JSON.parse(content) as NotebookDocument;
      return { document, error: null as string | null };
    } catch (error) {
      return {
        document: null,
        error: error instanceof Error ? error.message : "Could not parse this notebook.",
      };
    }
  }, [content]);

  if (parsed.error || !parsed.document) {
    return (
      <PreviewMessage
        title="Notebook preview unavailable"
        body={parsed.error ?? "This notebook could not be parsed."}
      />
    );
  }

  const cells = parsed.document.cells ?? [];

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--sh-bg)" }}>
      <div
        className="flex h-10 items-center gap-3 px-3 text-xs font-mono"
        style={{
          backgroundColor: "var(--sh-bg2)",
          borderBottom: "1px solid var(--sh-border)",
          color: "var(--sh-text2)",
        }}
      >
        <span className="truncate" title={name}>
          {name}
        </span>
        <span>{cells.length.toLocaleString()} cells</span>
        <span className="ml-auto">
          nbformat {parsed.document.nbformat ?? "?"}.{parsed.document.nbformat_minor ?? "?"}
        </span>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          {cells.length === 0 ? (
            <PreviewMessage
              title="Notebook preview unavailable"
              body="This notebook does not contain any cells."
            />
          ) : (
            cells.map((cell, index) => (
              <NotebookCellCard key={index} cell={cell} index={index} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function NotebookCellCard({ cell, index }: { cell: NotebookCell; index: number }) {
  const source = normalizeMultiline(cell.source);

  return (
    <section
      className="overflow-hidden rounded-xl"
      style={{
        backgroundColor: "var(--sh-bg2)",
        border: "1px solid var(--sh-border)",
      }}
    >
      <header
        className="flex items-center gap-3 px-4 py-3 text-xs font-mono"
        style={{
          borderBottom: "1px solid var(--sh-border)",
          color: "var(--sh-text2)",
        }}
      >
        <span>Cell {index + 1}</span>
        <span>{cell.cell_type}</span>
        {cell.cell_type === "code" && (
          <span className="ml-auto">execution {cell.execution_count ?? "-"}</span>
        )}
      </header>

      {cell.cell_type === "markdown" ? (
        <div
          className="markdown-body p-6"
          style={{ backgroundColor: "var(--sh-bg)" }}
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(marked.parse(source, { async: false }) as string),
          }}
        />
      ) : (
        <pre
          className="overflow-auto p-4 text-sm"
          style={{
            margin: 0,
            backgroundColor: "var(--sh-bg)",
            color: "var(--sh-text)",
            fontFamily: "var(--font-geist-mono), 'SF Mono', monospace",
          }}
        >
          {source}
        </pre>
      )}

      {cell.outputs && cell.outputs.length > 0 && (
        <div
          className="border-t px-4 py-4"
          style={{ borderColor: "var(--sh-border)", backgroundColor: "var(--sh-bg2)" }}
        >
          <div className="mb-3 text-xs font-mono uppercase tracking-wide" style={{ color: "var(--sh-text2)" }}>
            Output
          </div>
          <div className="flex flex-col gap-3">
            {cell.outputs.map((output, index) => (
              <NotebookOutputBlock key={index} output={output} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function NotebookOutputBlock({ output }: { output: NotebookOutput }) {
  if (output.output_type === "error") {
    const message = [...(output.traceback ?? []), output.evalue].filter(Boolean).join("\n");
    return <OutputPre content={message || `${output.ename ?? "Error"}`} tone="error" />;
  }

  const html = normalizeMimeOutput(output.data?.["text/html"]);
  if (html) {
    return (
      <div
        className="markdown-body rounded-lg p-4"
        style={{
          backgroundColor: "var(--sh-bg)",
          border: "1px solid var(--sh-border)",
        }}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
      />
    );
  }

  const imagePng = normalizeMimeOutput(output.data?.["image/png"]);
  if (imagePng) {
    return (
      <div
        className="rounded-lg p-4"
        style={{
          backgroundColor: "var(--sh-bg)",
          border: "1px solid var(--sh-border)",
        }}
      >
        {/* Notebook outputs are already base64-encoded image payloads. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/png;base64,${imagePng}`} alt="Notebook output" className="max-w-full rounded" />
      </div>
    );
  }

  const imageJpeg = normalizeMimeOutput(output.data?.["image/jpeg"]);
  if (imageJpeg) {
    return (
      <div
        className="rounded-lg p-4"
        style={{
          backgroundColor: "var(--sh-bg)",
          border: "1px solid var(--sh-border)",
        }}
      >
        {/* Notebook outputs are already base64-encoded image payloads. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/jpeg;base64,${imageJpeg}`} alt="Notebook output" className="max-w-full rounded" />
      </div>
    );
  }

  const text =
    normalizeMultiline(output.text) ||
    normalizeMimeOutput(output.data?.["text/plain"]) ||
    normalizeMimeOutput(output.data?.["application/json"]);

  if (text) {
    return <OutputPre content={text} />;
  }

  return (
    <div
      className="rounded-lg px-4 py-3 text-sm"
      style={{
        backgroundColor: "var(--sh-bg)",
        border: "1px solid var(--sh-border)",
        color: "var(--sh-text2)",
      }}
    >
      This output type is not yet rendered in the display view.
    </div>
  );
}

function OutputPre({
  content,
  tone = "default",
}: {
  content: string;
  tone?: "default" | "error";
}) {
  return (
    <pre
      className="overflow-auto rounded-lg p-4 text-sm"
      style={{
        margin: 0,
        backgroundColor: "var(--sh-bg)",
        border: "1px solid var(--sh-border)",
        color: tone === "error" ? "#ff7b72" : "var(--sh-text)",
        fontFamily: "var(--font-geist-mono), 'SF Mono', monospace",
      }}
    >
      {content}
    </pre>
  );
}

function normalizeMultiline(value: string | string[] | undefined): string {
  if (!value) return "";
  return Array.isArray(value) ? value.join("") : value;
}

function normalizeMimeOutput(value: string | string[] | undefined): string {
  if (!value) return "";
  return Array.isArray(value) ? value.join("") : value;
}
