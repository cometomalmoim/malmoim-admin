import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: '5mb' } },
  // The generated local encryption key must never be copied into deployment traces.
  outputFileTracingExcludes: { '/*': ['./.env.external-accounts.key'] },
  // Bundle renderer resources only for the authenticated, browser-only esign demo.
  outputFileTracingIncludes: {
    '/admin/esign-demo/assets/*': [
      './node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
      './node_modules/pdfjs-dist/cmaps/**/*',
      './node_modules/pdfjs-dist/standard_fonts/**/*',
      './node_modules/pdfjs-dist/wasm/**/*',
    ],
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
