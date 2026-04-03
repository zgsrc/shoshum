"use client";

import { useState, useEffect } from "react";

const GITHUB_REPO = "zgsrc/shoshum";
const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;
const API_LATEST_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

type Platform = "mac" | "windows" | "linux" | null;

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "mac";
  if (ua.includes("win")) return "windows";
  if (ua.includes("linux")) return "linux";
  return null;
}

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface ReleaseInfo {
  tag_name: string;
  html_url: string;
  assets: ReleaseAsset[];
}

interface DownloadOption {
  platform: Platform;
  label: string;
  description: string;
  fileName: string;
  icon: React.ReactNode;
  variants?: { label: string; fileName: string }[];
}

function findAssetUrl(assets: ReleaseAsset[], fileName: string): string | null {
  const asset = assets.find((a) => a.name === fileName);
  return asset?.browser_download_url ?? null;
}

const DOWNLOADS: DownloadOption[] = [
  {
    platform: "mac",
    label: "macOS",
    description: "Universal binary — Apple Silicon & Intel",
    fileName: "Shoshum-mac-universal.dmg",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
    ),
    variants: [
      { label: "DMG (Universal)", fileName: "Shoshum-mac-universal.dmg" },
      { label: "ZIP (Universal)", fileName: "Shoshum-mac-universal.zip" },
    ],
  },
  {
    platform: "windows",
    label: "Windows",
    description: "Windows 10 or later",
    fileName: "Shoshum-Setup-x64.exe",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 12V6.75l8-1.25V12H3zm0 .5h8v6.5l-8-1.25V12.5zM11.5 12V5.35l9.5-1.6V12h-9.5zm0 .5h9.5v8.25l-9.5-1.6V12.5z" />
      </svg>
    ),
    variants: [
      { label: "Installer (x64)", fileName: "Shoshum-Setup-x64.exe" },
      { label: "Installer (ARM64)", fileName: "Shoshum-Setup-arm64.exe" },
      { label: "Portable (x64)", fileName: "Shoshum-Portable-x64.exe" },
    ],
  },
  {
    platform: "linux",
    label: "Linux",
    description: "x64 and ARM64",
    fileName: "Shoshum-linux-x86_64.AppImage",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.345 1.884 1.345.199 0 .399-.034.585-.1.218-.066.442-.2.6-.334.466-.332.7-.667.795-.955.027-.199-.066-.4-.199-.534a.286.286 0 00-.066-.066c.133-.066.332-.198.468-.332.133-.135.2-.332.134-.535-.066-.199-.2-.398-.398-.535l-.469-.334a5.44 5.44 0 01-.4-.398 8.802 8.802 0 00-.135-.135l-.003-.003a8.89 8.89 0 01-.268-.399c-.205-.4-.27-.799-.27-1.065 0-.266.09-.468.2-.601.175-.133.332-.2.535-.268.466-.133.865-.469.797-1.065-.066-.601-.535-1.268-.868-1.734-.332-.465-.664-.798-.798-.864a.264.264 0 00-.066-.067c-.133-.066-.332-.066-.465-.066-.397 0-.665.398-.865.732a3.31 3.31 0 01-.669 1.002c-.091-.198-.267-.465-.666-.665-.4-.199-.997-.332-1.798-.332h-.098c.033-.133.267-.465.665-1.066.399-.6.864-1.399 1.066-2.398.066-.332.1-.664.1-.998V7.03c0-.266-.033-.532-.133-.798-.066-.266-.198-.532-.398-.732a3.468 3.468 0 00-.465-.4l-.002-.003c-.266-.2-.465-.332-.532-.332l-.002-.003c-.066-.066-.07-.2-.07-.332 0-.133.003-.266.003-.399 0-.932-.199-1.865-.798-2.531-.6-.666-1.465-.998-2.598-.998z" />
      </svg>
    ),
    variants: [
      { label: "AppImage (x64)", fileName: "Shoshum-linux-x86_64.AppImage" },
      { label: "AppImage (ARM64)", fileName: "Shoshum-linux-arm64.AppImage" },
      { label: "Debian (x64)", fileName: "shoshum-linux-amd64.deb" },
      { label: "Debian (ARM64)", fileName: "shoshum-linux-arm64.deb" },
    ],
  },
];

function DownloadCard({
  option,
  isPrimary,
  release,
}: {
  option: DownloadOption;
  isPrimary: boolean;
  release: ReleaseInfo | null;
}) {
  const [showVariants, setShowVariants] = useState(false);

  const primaryUrl = release
    ? findAssetUrl(release.assets, option.fileName)
    : null;
  const disabled = release !== null && primaryUrl === null;

  return (
    <div
      className="rounded-xl p-6 flex flex-col items-center text-center gap-4 transition-all"
      style={{
        backgroundColor: "var(--sh-bg2)",
        border: isPrimary
          ? "2px solid var(--sh-accent-blue)"
          : "1px solid var(--sh-border)",
        boxShadow: isPrimary
          ? "0 0 24px rgba(88, 166, 255, 0.15)"
          : undefined,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{ color: isPrimary ? "var(--sh-accent-blue)" : "var(--sh-text2)" }}>
        {option.icon}
      </div>
      <div>
        <h3 className="text-lg font-semibold" style={{ color: "var(--sh-text)" }}>
          {option.label}
        </h3>
        <p className="text-xs mt-1" style={{ color: "var(--sh-text2)" }}>
          {option.description}
        </p>
      </div>
      {primaryUrl ? (
        <a
          href={primaryUrl}
          className="px-6 py-2.5 rounded-lg text-sm font-medium transition-colors inline-block"
          style={{
            backgroundColor: isPrimary ? "var(--sh-btn-green)" : "var(--sh-bg-active)",
            color: isPrimary ? "#fff" : "var(--sh-text)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = isPrimary
              ? "var(--sh-btn-green-hover)"
              : "var(--sh-bg-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isPrimary
              ? "var(--sh-btn-green)"
              : "var(--sh-bg-active)";
          }}
        >
          Download
        </a>
      ) : (
        <span
          className="px-6 py-2.5 rounded-lg text-sm font-medium inline-block"
          style={{
            backgroundColor: "var(--sh-bg-active)",
            color: "var(--sh-text-muted)",
            cursor: "default",
          }}
        >
          Not yet available
        </span>
      )}
      {primaryUrl && option.variants && option.variants.length > 1 && (
        <div className="w-full">
          <button
            onClick={() => setShowVariants(!showVariants)}
            className="text-xs transition-colors"
            style={{ color: "var(--sh-text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--sh-text)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--sh-text-muted)")}
          >
            {showVariants ? "Hide" : "Other"} downloads ▾
          </button>
          {showVariants && (
            <div className="mt-2 flex flex-col gap-1">
              {option.variants
                .filter((v) => release && findAssetUrl(release.assets, v.fileName))
                .map((v) => (
                  <a
                    key={v.fileName}
                    href={findAssetUrl(release!.assets, v.fileName)!}
                    className="text-xs py-1 px-2 rounded transition-colors block"
                    style={{ color: "var(--sh-accent-blue)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--sh-bg-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    {v.label}
                  </a>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DownloadPage() {
  const [platform, setPlatform] = useState<Platform>(null);
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());

    fetch(API_LATEST_URL)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((data: ReleaseInfo) => setRelease(data))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...DOWNLOADS].sort((a, b) => {
    if (a.platform === platform) return -1;
    if (b.platform === platform) return 1;
    return 0;
  });

  const noRelease = !loading && (fetchError || !release);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--sh-bg)", color: "var(--sh-text)" }}
    >
      <header
        className="flex items-center justify-between h-12 px-6 shrink-0"
        style={{
          backgroundColor: "var(--sh-bg2)",
          borderBottom: "1px solid var(--sh-border)",
        }}
      >
        <a href="/" className="text-sm font-semibold tracking-wide font-mono" style={{ color: "var(--sh-text)", textDecoration: "none" }}>
          shoshum
        </a>
        <a
          href={`https://github.com/${GITHUB_REPO}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs transition-colors"
          style={{ color: "var(--sh-text2)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--sh-text)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--sh-text2)")}
        >
          GitHub
        </a>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-3xl w-full text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl mx-auto mb-6" style={{ backgroundColor: "var(--sh-bg2)", border: "1px solid var(--sh-bg-active)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--sh-accent-blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold mb-3" style={{ color: "var(--sh-text)" }}>
            Download Shoshum
          </h1>
          <p className="text-sm mb-12 max-w-lg mx-auto" style={{ color: "var(--sh-text2)" }}>
            A technical file viewer and editor that runs completely offline. Opens anything, edits everything — no internet required.
          </p>

          {loading ? (
            <p className="text-sm py-12" style={{ color: "var(--sh-text-muted)" }}>
              Checking for releases…
            </p>
          ) : noRelease ? (
            <div
              className="rounded-xl p-8 mb-12 mx-auto max-w-md"
              style={{
                backgroundColor: "var(--sh-bg2)",
                border: "1px solid var(--sh-border)",
              }}
            >
              <p className="text-sm mb-3" style={{ color: "var(--sh-text)" }}>
                No releases available yet
              </p>
              <p className="text-xs mb-4" style={{ color: "var(--sh-text2)" }}>
                Desktop builds haven&apos;t been published. You can use Shoshum in your browser right now, or build from source.
              </p>
              <div className="flex items-center justify-center gap-4">
                <a
                  href="/"
                  className="px-5 py-2 rounded-lg text-sm font-medium transition-colors inline-block"
                  style={{
                    backgroundColor: "var(--sh-btn-green)",
                    color: "#fff",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--sh-btn-green-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--sh-btn-green)")}
                >
                  Use in browser
                </a>
                <a
                  href={`https://github.com/${GITHUB_REPO}#readme`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2 rounded-lg text-sm font-medium transition-colors inline-block"
                  style={{
                    backgroundColor: "var(--sh-bg-active)",
                    color: "var(--sh-text)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--sh-bg-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--sh-bg-active)")}
                >
                  Build from source
                </a>
              </div>
            </div>
          ) : (
            <>
              {release && (
                <p className="text-xs mb-4" style={{ color: "var(--sh-text-muted)" }}>
                  Latest release: {release.tag_name}
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
                {sorted.map((opt) => (
                  <DownloadCard
                    key={opt.platform}
                    option={opt}
                    isPrimary={opt.platform === platform}
                    release={release}
                  />
                ))}
              </div>
            </>
          )}

          <div className="flex flex-col items-center gap-4">
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs transition-colors"
              style={{ color: "var(--sh-accent-blue)" }}
            >
              View all releases on GitHub →
            </a>
            <div className="text-xs max-w-md" style={{ color: "var(--sh-text-muted)" }}>
              <p className="mb-2">
                Shoshum Desktop is the same app as the web version, packaged to run locally. Your files never leave your machine.
              </p>
              <p>
                Free and open source under the MIT License.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer
        className="h-10 flex items-center justify-center text-[11px] shrink-0"
        style={{
          backgroundColor: "var(--sh-bg2)",
          borderTop: "1px solid var(--sh-border)",
          color: "var(--sh-text-muted)",
        }}
      >
        <a href="/" style={{ color: "var(--sh-text-muted)", textDecoration: "none" }}>
          ← Use shoshum in your browser
        </a>
      </footer>
    </div>
  );
}
