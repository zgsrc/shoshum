"use client";

import { useEffect, useState } from "react";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import PreviewMessage from "./PreviewMessage";

interface DocxViewerProps {
  bytes: Uint8Array;
  name: string;
}

interface MammothResultMessage {
  message: string;
  type?: string;
}

export default function DocxViewer({ bytes, name }: DocxViewerProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [messages, setMessages] = useState<MammothResultMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    const convert = async () => {
      try {
        const mammothModule = await import("mammoth");
        const mammoth = (mammothModule.default ?? mammothModule) as {
          convertToHtml: (input: { arrayBuffer: ArrayBuffer }) => Promise<{
            value: string;
            messages: MammothResultMessage[];
          }>;
        };

        const result = await mammoth.convertToHtml({
          arrayBuffer: bytes.slice().buffer as ArrayBuffer,
        });

        if (!disposed) {
          setHtml(sanitizeHtml(result.value));
          setMessages(result.messages ?? []);
          setError(null);
        }
      } catch (reason) {
        if (!disposed) {
          setError(reason instanceof Error ? reason.message : "Could not convert this DOCX file.");
        }
      }
    };

    setHtml(null);
    setMessages([]);
    setError(null);
    void convert();

    return () => {
      disposed = true;
    };
  }, [bytes]);

  if (error) {
    return <PreviewMessage title="DOCX preview unavailable" body={error} />;
  }

  if (!html) {
    return (
      <PreviewMessage
        title="Preparing DOCX preview"
        body="Converting the Word document into browser-renderable HTML."
      />
    );
  }

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
        <span className="ml-auto">DOCX preview</span>
      </div>
      <div className="flex-1 overflow-auto p-6">
        {messages.length > 0 && (
          <div
            className="mx-auto mb-4 max-w-4xl rounded-xl px-4 py-3 text-sm"
            style={{
              backgroundColor: "var(--sh-bg2)",
              border: "1px solid var(--sh-border)",
              color: "var(--sh-text2)",
            }}
          >
            {messages[0]?.message}
          </div>
        )}
        <article
          className="markdown-body mx-auto max-w-4xl rounded-xl p-8"
          style={{
            backgroundColor: "var(--sh-bg2)",
            border: "1px solid var(--sh-border)",
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
