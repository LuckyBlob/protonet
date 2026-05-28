import type { NextConfig } from "next";

const nextConfig: NextConfig =
{
  output: "standalone",
  allowedDevOrigins: ["lawstrom.net"],
  devIndicators: false,
};

export default nextConfig;
