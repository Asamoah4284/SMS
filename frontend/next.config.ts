import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cuts dev double-render noise that can surface as MetadataWrapper / head hydration warnings with React 19.
  reactStrictMode: false,
};

export default nextConfig;
