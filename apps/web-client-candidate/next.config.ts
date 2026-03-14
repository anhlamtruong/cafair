import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@starter/db", "@starter/ui"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.gstatic.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
