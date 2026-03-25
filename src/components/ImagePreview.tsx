"use client";

import { useEffect, useMemo, useState } from "react";
import { formatBytes, getImageMimeType } from "@/lib/fileUtils";

interface ImagePreviewProps {
  bytes: Uint8Array;
  fileName: string;
  fileSize: number;
}

export default function ImagePreview({ bytes, fileName, fileSize }: ImagePreviewProps) {
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState(false);

  const blobUrl = useMemo(() => {
    const mime = getImageMimeType(fileName);
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mime });
    return URL.createObjectURL(blob);
  }, [bytes, fileName]);

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  if (error) {
    return (
      <div
        className="flex items-center justify-center h-full w-full"
        style={{ backgroundColor: "var(--sh-bg)" }}
      >
        <div className="text-center">
          <p className="text-sm" style={{ color: "var(--sh-text2)" }}>
            Unable to preview this image
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--sh-text-muted)" }}>
            Switch to Hex view to inspect the raw bytes
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full w-full overflow-hidden"
      style={{ backgroundColor: "var(--sh-bg)" }}
    >
      <div className="flex-1 flex items-center justify-center overflow-auto p-8">
        {/* Object URLs do not benefit from Next image optimization. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={blobUrl}
          alt={fileName}
          className="max-w-full max-h-full object-contain rounded shadow-lg"
          style={{ background: "repeating-conic-gradient(var(--sh-bg-hover) 0% 25%, var(--sh-bg-active) 0% 50%) 50% / 16px 16px" }}
          onLoad={(e) => {
            const img = e.target as HTMLImageElement;
            setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
          }}
          onError={() => setError(true)}
        />
      </div>
      <div
        className="flex items-center justify-center gap-4 h-8 text-xs font-mono shrink-0"
        style={{ color: "var(--sh-text2)", borderTop: "1px solid var(--sh-border)" }}
      >
        <span>{fileName}</span>
        <span>{formatBytes(fileSize)}</span>
        {dimensions && <span>{dimensions.w} x {dimensions.h}</span>}
      </div>
    </div>
  );
}
