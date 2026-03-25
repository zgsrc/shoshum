"use client";

import { useEffect, useMemo, useState } from "react";
import PreviewMessage from "./PreviewMessage";

interface FontViewerProps {
  bytes: Uint8Array;
  mimeType: string;
  name: string;
}

const FONT_SIZES = [24, 36, 52, 80];
const SAMPLE_TEXT = "Sphinx of black quartz, judge my vow.";

export default function FontViewer({ bytes, mimeType, name }: FontViewerProps) {
  const [loadedFont, setLoadedFont] = useState<{ key: string; family: string } | null>(null);
  const [loadError, setLoadError] = useState<{ key: string; message: string } | null>(null);

  const objectUrl = useMemo(() => {
    const blob = new Blob([bytes.slice().buffer], { type: mimeType || "font/ttf" });
    return URL.createObjectURL(blob);
  }, [bytes, mimeType]);

  const fontKey = `${name}:${objectUrl}`;
  const fontFamily = loadedFont?.key === fontKey ? loadedFont.family : null;
  const error = loadError?.key === fontKey ? loadError.message : null;

  useEffect(() => {
    const family = `shoshum-font-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
    const fontFace = new FontFace(family, `url(${objectUrl})`);
    let disposed = false;

    void fontFace
      .load()
      .then((loadedFace) => {
        if (disposed) return;
        document.fonts.add(loadedFace);
        setLoadedFont({ key: fontKey, family });
      })
      .catch(() => {
        if (!disposed) {
          setLoadError({
            key: fontKey,
            message: "This font could not be loaded in the browser preview.",
          });
        }
      });

    return () => {
      disposed = true;
      document.fonts.delete(fontFace);
      URL.revokeObjectURL(objectUrl);
    };
  }, [fontKey, name, objectUrl]);

  if (error) {
    return <PreviewMessage title="Font preview unavailable" body={error} />;
  }

  if (!fontFamily) {
    return (
      <PreviewMessage
        title="Preparing font preview"
        body="Loading the font into the browser so it can be previewed."
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
        <span className="ml-auto">Font preview</span>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div
          className="mx-auto max-w-5xl rounded-xl p-6"
          style={{
            backgroundColor: "var(--sh-bg2)",
            border: "1px solid var(--sh-border)",
          }}
        >
          {FONT_SIZES.map((size) => (
            <div key={size} className="mb-8 last:mb-0">
              <div
                className="mb-2 text-xs font-mono uppercase tracking-wide"
                style={{ color: "var(--sh-text2)" }}
              >
                {size}px
              </div>
              <div style={{ fontFamily, fontSize: `${size}px`, color: "var(--sh-text)" }}>
                {SAMPLE_TEXT}
              </div>
            </div>
          ))}

          <div className="mt-10">
            <div
              className="mb-2 text-xs font-mono uppercase tracking-wide"
              style={{ color: "var(--sh-text2)" }}
            >
              Character set
            </div>
            <div
              className="grid grid-cols-2 gap-4 rounded-lg p-4 md:grid-cols-4"
              style={{
                backgroundColor: "var(--sh-bg)",
                border: "1px solid var(--sh-border)",
              }}
            >
              {[
                "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
                "abcdefghijklmnopqrstuvwxyz",
                "0123456789",
                "!@#$%^&*()[]{}<>?/+-=_:;,.\"'",
              ].map((group) => (
                <div key={group} style={{ fontFamily, color: "var(--sh-text)", fontSize: "22px" }}>
                  {group}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
