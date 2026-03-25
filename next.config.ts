import type { NextConfig } from "next";

const isElectronBuild = process.env.NEXT_OUTPUT === "export";

const nextConfig: NextConfig = {
  ...(isElectronBuild
    ? {
        output: "export",
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
