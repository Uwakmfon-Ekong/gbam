import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Receipt photos are resized client-side to ~1200px, but leave headroom.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
