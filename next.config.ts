import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the e2e test server (NEXT_DIST_DIR=.next-test) run alongside the dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The floating dev badge sits on top of the sidebar avatar and the mobile tab bar.
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
