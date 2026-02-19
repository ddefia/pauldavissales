import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow large file uploads (up to 100MB for big Excel files)
  serverExternalPackages: ["exceljs", "xlsx"],
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
