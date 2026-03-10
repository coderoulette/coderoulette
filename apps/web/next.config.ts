import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@clauderoulette/shared"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
};

export default nextConfig;
