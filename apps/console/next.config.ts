import type { NextConfig } from "next";

// console.satelink.network — the customer console, split out of apps/web.
// DNS (Cloudflare, DNS-only): console CNAME → cname.vercel-dns.com.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@satelink/web-ui"],
  // Release A local preview only: production gets /api/identity from the Vercel rewrite (vercel.json).
  // Evaluated at build time for `next start` — build with SATELINK_PREVIEW=1 for a preview build.
  async rewrites() {
    if (process.env.SATELINK_PREVIEW !== "1") return [];
    return [{ source: "/api/identity/:path*", destination: `${process.env.SATELINK_API_BASE || "http://127.0.0.1:4500"}/api/identity/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
