import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * This app sits inside a wider desktop-level repository, so Turbopack's
   * automatic root inference walks too far up and picks the wrong lockfile.
   */
  turbopack: {
    root: path.resolve(__dirname),
  },

  /*
   * Next's dev-tools badge draws a circled "N" over the bottom-left corner of
   * every page in development. Harmless normally — but this app gets projected
   * in front of a room, and a facilitator rehearsing on `npm run dev` would see
   * a stray letter sitting on the join screen.
   */
  devIndicators: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
