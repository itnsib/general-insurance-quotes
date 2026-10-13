import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Loaded from node_modules at run time rather than bundled: @sparticuz/chromium
  // unpacks its own browser binary, which bundling would leave behind.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // The PDF route reads the document's artwork and insurer logos from public/
  // on disk (see app/lib/pdf.ts), and Vercel only ships files a function is
  // traced to use.
  outputFileTracingIncludes: {
    "/api/render-pdf": [
      "./public/pdf/**/*",
      "./public/insurers/**/*",
      "./node_modules/@sparticuz/chromium/bin/**/*",
    ],
  },
};

export default nextConfig;
