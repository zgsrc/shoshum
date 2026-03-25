"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";
import {
  formatLabel,
  getDisplayInfo,
  toBlob,
  type FileFormat,
} from "@/lib/fileUtils";
import PreviewMessage from "./viewers/PreviewMessage";

interface DisplayViewerProps {
  name: string;
  format: FileFormat;
  mimeType: string;
  content: string;
  bytes: Uint8Array;
  isBinary: boolean;
}

function loadingMessage(title: string, body: string) {
  function DisplayViewerLoadingMessage() {
    return <PreviewMessage title={title} body={body} />;
  }

  DisplayViewerLoadingMessage.displayName = "DisplayViewerLoadingMessage";
  return DisplayViewerLoadingMessage;
}

const PdfViewer = dynamic(() => import("./PdfViewer"), {
  ssr: false,
  loading: loadingMessage("Preparing PDF viewer", "Loading PDF support for this file."),
});

const StructuredDataViewer = dynamic(() => import("./viewers/StructuredDataViewer"), {
  ssr: false,
  loading: loadingMessage("Preparing structured preview", "Parsing the document into a navigable tree."),
});

const CsvTableViewer = dynamic(() => import("./viewers/CsvTableViewer"), {
  ssr: false,
  loading: loadingMessage("Preparing table preview", "Reading rows and columns for this file."),
});

const FontViewer = dynamic(() => import("./viewers/FontViewer"), {
  ssr: false,
  loading: loadingMessage("Preparing font preview", "Loading the font into the browser."),
});

const GeoJsonViewer = dynamic(() => import("./viewers/GeoJsonViewer"), {
  ssr: false,
  loading: loadingMessage("Preparing map preview", "Parsing geometry and drawing the map preview."),
});

const NotebookViewer = dynamic(() => import("./viewers/NotebookViewer"), {
  ssr: false,
  loading: loadingMessage("Preparing notebook preview", "Loading notebook cells and outputs."),
});

const SqliteViewer = dynamic(() => import("./viewers/SqliteViewer"), {
  ssr: false,
  loading: loadingMessage("Preparing SQLite preview", "Loading the database engine for this file."),
});

const DocxViewer = dynamic(() => import("./viewers/DocxViewer"), {
  ssr: false,
  loading: loadingMessage("Preparing DOCX preview", "Converting the document into HTML."),
});

const SpreadsheetViewer = dynamic(() => import("./viewers/SpreadsheetViewer"), {
  ssr: false,
  loading: loadingMessage("Preparing spreadsheet preview", "Parsing workbook sheets and cells."),
});

const PresentationViewer = dynamic(() => import("./viewers/PresentationViewer"), {
  ssr: false,
  loading: loadingMessage("Preparing presentation preview", "Extracting slide text from the presentation."),
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
    () => getDisplayInfo(name, mimeType, format),
    [name, mimeType, format]
  );

  const previewBlob = useMemo(() => {
    if (!displayInfo) return null;
    if (
      displayInfo.kind === "pdf" ||
      displayInfo.kind === "structured" ||
      displayInfo.kind === "csv" ||
      displayInfo.kind === "font" ||
      displayInfo.kind === "geojson" ||
      displayInfo.kind === "notebook" ||
      displayInfo.kind === "sqlite" ||
      displayInfo.kind === "docx" ||
      displayInfo.kind === "spreadsheet" ||
      displayInfo.kind === "presentation"
    ) {
      return null;
    }
    if (!isBinary) {
      return new Blob([content], { type: displayInfo.mimeType });
    }
    return toBlob(bytes, displayInfo.mimeType);
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

  if (displayInfo.kind === "structured") {
    return (
      <StructuredDataViewer
        name={name}
        format={format as "json" | "yaml" | "xml"}
        content={content}
      />
    );
  }

  if (displayInfo.kind === "csv") {
    return <CsvTableViewer name={name} content={content} />;
  }

  if (displayInfo.kind === "font") {
    return <FontViewer name={name} bytes={bytes} mimeType={displayInfo.mimeType} />;
  }

  if (displayInfo.kind === "geojson") {
    return <GeoJsonViewer name={name} content={content} />;
  }

  if (displayInfo.kind === "notebook") {
    return <NotebookViewer name={name} content={content} />;
  }

  if (displayInfo.kind === "sqlite") {
    return <SqliteViewer name={name} bytes={bytes} />;
  }

  if (displayInfo.kind === "docx") {
    return <DocxViewer name={name} bytes={bytes} />;
  }

  if (displayInfo.kind === "spreadsheet") {
    return <SpreadsheetViewer name={name} bytes={bytes} />;
  }

  if (displayInfo.kind === "presentation") {
    return <PresentationViewer name={name} bytes={bytes} />;
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
