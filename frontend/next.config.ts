import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cuts dev double-render noise that can surface as MetadataWrapper / head hydration warnings with React 19.
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i0.wp.com",
      },
    ],
  },
};

export default nextConfig;
