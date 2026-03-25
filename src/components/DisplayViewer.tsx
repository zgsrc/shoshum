"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";
import {
  formatLabel,
  getNativeDisplayInfo,
  type FileFormat,
} from "@/lib/fileUtils";

interface DisplayViewerProps {
  name: string;
  format: FileFormat;
  mimeType: string;
  content: string;
  bytes: Uint8Array;
  isBinary: boolean;
}

function PreviewMessage({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
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

const PdfViewer = dynamic(() => import("./PdfViewer"), {
  ssr: false,
  loading: () => (
    <PreviewMessage
      title="Preparing PDF viewer"
      body="Loading PDF support for this file."
    />
  ),
});

export default function DisplayViewer({
  name,
  format,
  mimeType,
  content,
  bytes,
  isBinary,
}: DisplayViewerProps) {
  const displayInfo = useMemo(
    () => getNativeDisplayInfo(name, mimeType, format),
    [name, mimeType, format]
  );

  const previewBlob = useMemo(() => {
    if (!displayInfo) return null;
    if (displayInfo.kind === "pdf") return null;
    if (!isBinary) {
      return new Blob([content], { type: displayInfo.mimeType });
    }
    return new Blob([bytes.slice().buffer], { type: displayInfo.mimeType });
  }, [displayInfo, content, bytes, isBinary]);

  const objectUrl = useMemo(
    () => (previewBlob ? URL.createObjectURL(previewBlob) : null),
    [previewBlob]
  );

  useEffect(() => {
    if (!objectUrl) return;
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  if (!displayInfo) {
    return (
      <PreviewMessage
        title="No preview available"
        body={`This ${formatLabel(format).toLowerCase()} file does not have a built-in preview. Try the Text or Binary view instead.`}
      />
    );
  }

  if (displayInfo.kind === "pdf") {
    return <PdfViewer name={name} bytes={bytes} />;
  }

  if (!objectUrl) {
    return (
      <PreviewMessage
        title="Preparing preview"
        body="Building a browser preview for this file."
      />
    );
  }

  if (displayInfo.kind === "image") {
    return (
      <div
        className="flex h-full w-full items-center justify-center overflow-auto p-6"
        style={{ backgroundColor: "var(--sh-bg)" }}
      >
        {/* Object URLs do not benefit from Next image optimization. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={objectUrl}
          alt={name}
          className="max-h-full max-w-full rounded-lg object-contain"
          style={{ boxShadow: "0 16px 48px rgba(0, 0, 0, 0.28)" }}
        />
      </div>
    );
  }

  if (displayInfo.kind === "audio") {
    return (
      <div
        className="flex h-full w-full items-center justify-center p-6"
        style={{ backgroundColor: "var(--sh-bg)" }}
      >
        <div
          className="w-full max-w-xl rounded-xl p-6"
          style={{
            backgroundColor: "var(--sh-bg2)",
            border: "1px solid var(--sh-border)",
          }}
        >
          <div className="mb-4 text-sm font-medium" style={{ color: "var(--sh-text)" }}>
            {name}
          </div>
          <audio src={objectUrl} controls className="w-full" />
        </div>
      </div>
    );
  }

  if (displayInfo.kind === "video") {
    return (
      <div
        className="flex h-full w-full items-center justify-center overflow-auto p-6"
        style={{ backgroundColor: "var(--sh-bg)" }}
      >
        <video
          src={objectUrl}
          controls
          className="max-h-full max-w-full rounded-lg"
          style={{ backgroundColor: "#000000" }}
        />
      </div>
    );
  }

  return (
    <iframe
      title={`${name} preview`}
      src={objectUrl}
      sandbox="allow-scripts"
      className="h-full w-full border-0"
    />
  );
}
