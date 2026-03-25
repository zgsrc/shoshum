"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";

type PdfModule = typeof import("pdfjs-dist");
type PdfDocument = import("pdfjs-dist").PDFDocumentProxy;
type PdfLoadingTask = import("pdfjs-dist").PDFDocumentLoadingTask;
type PdfRenderTask = import("pdfjs-dist").RenderTask;

interface PdfViewerProps {
  bytes: Uint8Array;
  name: string;
}

interface PasswordRequestState {
  reason: number;
  submit: (password: string) => void;
}

function ViewerMessage({
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

function ToolbarButton({
  disabled,
  label,
  onClick,
}: {
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        backgroundColor: disabled ? "transparent" : "var(--sh-bg-active)",
        border: "1px solid var(--sh-border)",
        color: disabled ? "var(--sh-text-muted)" : "var(--sh-text)",
      }}
    >
      {label}
    </button>
  );
}

export default function PdfViewer({ bytes, name }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const documentRef = useRef<PdfDocument | null>(null);
  const loadingTaskRef = useRef<PdfLoadingTask | null>(null);
  const renderTaskRef = useRef<PdfRenderTask | null>(null);

  const [pdfjs, setPdfjs] = useState<PdfModule | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [loadingLabel, setLoadingLabel] = useState<string | null>("Loading PDF support...");
  const [error, setError] = useState<string | null>(null);
  const [passwordRequest, setPasswordRequest] = useState<PasswordRequestState | null>(null);
  const [passwordValue, setPasswordValue] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadPdfModule = async () => {
      try {
        const pdfModule = await import("pdfjs-dist");
        pdfModule.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        if (!cancelled) {
          setPdfjs(pdfModule);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load PDF support in this browser.");
          setLoadingLabel(null);
        }
      }
    };

    void loadPdfModule();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateWidth = () => setContainerWidth(element.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!passwordRequest) return;
    passwordInputRef.current?.focus();
    passwordInputRef.current?.select();
  }, [passwordRequest]);

  useEffect(() => {
    if (!pdfjs) return;

    let disposed = false;
    const loadingTask = pdfjs.getDocument({ data: bytes.slice() });
    loadingTaskRef.current = loadingTask;
    documentRef.current = null;
    setCurrentPage(1);
    setPageCount(0);
    setError(null);
    setPasswordRequest(null);
    setPasswordValue("");
    setLoadingLabel("Opening PDF...");

    loadingTask.onProgress = (progress: { loaded: number; total?: number }) => {
      if (disposed || !progress.total) return;
      const percent = Math.round((progress.loaded / progress.total) * 100);
      setLoadingLabel(`Opening PDF... ${percent}%`);
    };

    loadingTask.onPassword = (
      submitPassword: (password: string) => void,
      reason: number
    ) => {
      if (disposed) return;
      setPasswordValue("");
      setLoadingLabel(null);
      setPasswordRequest({
        reason,
        submit: (password: string) => {
          setPasswordRequest(null);
          setLoadingLabel("Unlocking PDF...");
          submitPassword(password);
        },
      });
    };

    void loadingTask.promise
      .then(async (document) => {
        if (disposed) {
          await document.destroy();
          return;
        }

        documentRef.current = document;
        setPageCount(document.numPages);
        setCurrentPage(1);
        setLoadingLabel("Rendering page...");
      })
      .catch((reason: unknown) => {
        if (disposed) return;

        const message = reason instanceof Error ? reason.message : String(reason);
        if (message.toLowerCase().includes("password")) {
          setError("This PDF could not be unlocked.");
        } else {
          setError("Could not open this PDF.");
        }
        setLoadingLabel(null);
      });

    return () => {
      disposed = true;
      loadingTaskRef.current = null;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;

      const activeDocument = documentRef.current;
      documentRef.current = null;

      void loadingTask.destroy().catch(() => {});
      if (activeDocument) {
        void activeDocument.destroy().catch(() => {});
      }
    };
  }, [bytes, pdfjs]);

  useEffect(() => {
    const document = documentRef.current;
    const canvas = canvasRef.current;
    if (!document || !canvas || !containerWidth) return;

    let cancelled = false;
    setError(null);
    setLoadingLabel("Rendering page...");

    const renderPage = async () => {
      const page = await document.getPage(currentPage);
      if (cancelled) return;

      const baseViewport = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(containerWidth - 48, 240);
      const scale = Math.max(0.75, Math.min(2.5, availableWidth / baseViewport.width));
      const viewport = page.getViewport({ scale });
      const pixelRatio = window.devicePixelRatio || 1;
      const context = canvas.getContext("2d");

      if (!context) {
        setError("Could not create a canvas for this PDF preview.");
        setLoadingLabel(null);
        return;
      }

      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);

      renderTaskRef.current?.cancel();
      const renderTask = page.render({
        canvas,
        viewport,
        transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
      });
      renderTaskRef.current = renderTask;
      await renderTask.promise;

      if (cancelled) return;
      renderTaskRef.current = null;
      setLoadingLabel(null);
    };

    void renderPage().catch((reason: unknown) => {
      if (cancelled) return;

      const message = reason instanceof Error ? reason.name : String(reason);
      if (message === "RenderingCancelledException") return;
      setError("Could not render this PDF page.");
      setLoadingLabel(null);
    });

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [containerWidth, currentPage, pageCount]);

  const handlePasswordSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!passwordRequest) return;
      passwordRequest.submit(passwordValue);
    },
    [passwordRequest, passwordValue]
  );

  const handlePasswordCancel = useCallback(() => {
    setPasswordRequest(null);
    setLoadingLabel(null);
    setError("PDF preview was cancelled.");
    const task = loadingTaskRef.current;
    loadingTaskRef.current = null;
    if (task) {
      void task.destroy().catch(() => {});
    }
  }, []);

  const passwordHelpText =
    passwordRequest && pdfjs && passwordRequest.reason === pdfjs.PasswordResponses.INCORRECT_PASSWORD
      ? "That password did not unlock this PDF. Try another password."
      : "This PDF is password protected. Enter the password to preview it.";

  return (
    <div className="flex h-full w-full flex-col" style={{ backgroundColor: "var(--sh-bg)" }}>
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
        {pageCount > 0 ? (
          <div className="ml-auto flex items-center gap-2">
            <ToolbarButton
              disabled={currentPage <= 1}
              label="Prev"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            />
            <span style={{ color: "var(--sh-text)" }}>
              {currentPage} / {pageCount}
            </span>
            <ToolbarButton
              disabled={currentPage >= pageCount}
              label="Next"
              onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
            />
          </div>
        ) : loadingLabel ? (
          <span className="ml-auto">{loadingLabel}</span>
        ) : null}
      </div>

      <div
        ref={containerRef}
        className="relative flex-1 overflow-auto p-6"
        style={{ backgroundColor: "var(--sh-bg)" }}
      >
        {error ? (
          <ViewerMessage title="PDF preview unavailable" body={error} />
        ) : (
          <div className="flex min-h-full items-start justify-center">
            <canvas
              ref={canvasRef}
              className={pageCount > 0 ? "rounded-lg" : "hidden"}
              style={{ boxShadow: "0 16px 48px rgba(0, 0, 0, 0.28)" }}
            />
          </div>
        )}

        {loadingLabel && !passwordRequest && !error ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{
                backgroundColor: "color-mix(in srgb, var(--sh-bg2) 92%, transparent)",
                border: "1px solid var(--sh-border)",
                color: "var(--sh-text)",
              }}
            >
              {loadingLabel}
            </div>
          </div>
        ) : null}

        {passwordRequest ? (
          <div
            className="absolute inset-0 flex items-center justify-center p-6"
            style={{ backgroundColor: "rgba(0, 0, 0, 0.48)" }}
          >
            <form
              onSubmit={handlePasswordSubmit}
              className="w-full max-w-sm rounded-xl p-6"
              style={{
                backgroundColor: "var(--sh-bg2)",
                border: "1px solid var(--sh-border)",
              }}
            >
              <h2 className="mb-2 text-sm font-semibold" style={{ color: "var(--sh-text)" }}>
                PDF password required
              </h2>
              <p className="mb-4 text-sm leading-relaxed" style={{ color: "var(--sh-text2)" }}>
                {passwordHelpText}
              </p>
              <input
                ref={passwordInputRef}
                type="password"
                value={passwordValue}
                onChange={(event) => setPasswordValue(event.target.value)}
                className="w-full rounded-md px-3 py-2 text-sm outline-none"
                style={{
                  backgroundColor: "var(--sh-bg)",
                  border: "1px solid var(--sh-border)",
                  color: "var(--sh-text)",
                }}
                placeholder="Enter password"
                autoComplete="current-password"
              />
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handlePasswordCancel}
                  className="rounded px-3 py-1.5 text-sm transition-colors"
                  style={{
                    backgroundColor: "transparent",
                    border: "1px solid var(--sh-border)",
                    color: "var(--sh-text2)",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded px-3 py-1.5 text-sm transition-colors"
                  style={{
                    backgroundColor: "var(--sh-btn-green)",
                    color: "#ffffff",
                  }}
                >
                  Unlock PDF
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
