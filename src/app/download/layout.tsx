import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Download Shoshum",
  description:
    "Download Shoshum for Windows, macOS, or Linux. A technical file viewer and editor that runs completely offline.",
};

export default function DownloadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
