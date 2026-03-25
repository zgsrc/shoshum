"use client";

import { useEffect, useState } from "react";
import PreviewMessage from "./PreviewMessage";

interface PresentationViewerProps {
  bytes: Uint8Array;
  name: string;
}

interface SlidePreview {
  index: number;
  text: string[];
  notes: string[];
}

export default function PresentationViewer({ bytes, name }: PresentationViewerProps) {
  const [slides, setSlides] = useState<SlidePreview[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    const parsePresentation = async () => {
      try {
        const { unzipSync } = await import("fflate");
        const archive = unzipSync(bytes);
        const decoder = new TextDecoder("utf-8", { fatal: false });
        const slidePaths = Object.keys(archive)
          .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
          .sort((a, b) => getSlideNumber(a) - getSlideNumber(b));

        const nextSlides = slidePaths.map((path) => {
          const index = getSlideNumber(path);
          const slideXml = decoder.decode(archive[path]);
          const notesPath = `ppt/notesSlides/notesSlide${index}.xml`;
          const notesXml = archive[notesPath] ? decoder.decode(archive[notesPath]) : "";

          return {
            index,
            text: extractXmlText(slideXml),
            notes: extractXmlText(notesXml),
          };
        });

        if (!disposed) {
          setSlides(nextSlides);
          setError(null);
        }
      } catch (reason) {
        if (!disposed) {
          setError(reason instanceof Error ? reason.message : "Could not parse this PowerPoint file.");
        }
      }
    };

    setSlides(null);
    setError(null);
    void parsePresentation();

    return () => {
      disposed = true;
    };
  }, [bytes]);

  if (error) {
    return <PreviewMessage title="Presentation preview unavailable" body={error} />;
  }

  if (!slides) {
    return (
      <PreviewMessage
        title="Preparing presentation preview"
        body="Unpacking the presentation and extracting slide text."
      />
    );
  }

  if (slides.length === 0) {
    return (
      <PreviewMessage
        title="Presentation preview unavailable"
        body="Only Open XML presentations with readable slide XML are currently previewed."
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
        <span>{slides.length.toLocaleString()} slides</span>
        <span className="ml-auto">Presentation preview</span>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2 xl:grid-cols-3">
          {slides.map((slide) => (
            <section
              key={slide.index}
              className="overflow-hidden rounded-xl"
              style={{
                backgroundColor: "var(--sh-bg2)",
                border: "1px solid var(--sh-border)",
              }}
            >
              <header
                className="px-4 py-3 text-xs font-mono"
                style={{
                  borderBottom: "1px solid var(--sh-border)",
                  color: "var(--sh-text2)",
                }}
              >
                Slide {slide.index}
              </header>
              <div className="p-4">
                <div
                  className="mb-3 min-h-48 rounded-lg p-4"
                  style={{
                    backgroundColor: "var(--sh-bg)",
                    border: "1px solid var(--sh-border)",
                  }}
                >
                  {slide.text.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {slide.text.map((line, index) => (
                        <p key={index} className="m-0 text-sm leading-relaxed" style={{ color: "var(--sh-text)" }}>
                          {line}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm" style={{ color: "var(--sh-text2)" }}>
                      This slide does not expose text content in the preview.
                    </div>
                  )}
                </div>
                {slide.notes.length > 0 && (
                  <div className="text-xs leading-relaxed" style={{ color: "var(--sh-text2)" }}>
                    <div className="mb-1 font-mono uppercase tracking-wide">Notes</div>
                    <div>{slide.notes.join(" ")}</div>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function getSlideNumber(path: string): number {
  const match = path.match(/slide(\d+)\.xml$/);
  return match ? Number(match[1]) : 0;
}

function extractXmlText(xml: string): string[] {
  if (!xml) return [];
  const values: string[] = [];
  const matches = xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g);
  for (const match of matches) {
    const text = decodeXmlEntities(match[1]).trim();
    if (text) values.push(text);
  }
  return values;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
