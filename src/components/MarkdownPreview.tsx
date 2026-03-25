"use client";

import { useMemo } from "react";
import { marked } from "marked";

interface MarkdownPreviewProps {
  content: string;
}

export default function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const html = useMemo(() => {
    try {
      return marked.parse(content, { async: false }) as string;
    } catch {
      return "<p>Failed to parse markdown</p>";
    }
  }, [content]);

  return (
    <div
      className="h-full w-full overflow-auto p-8 markdown-body"
      style={{ backgroundColor: "var(--sh-bg)" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
