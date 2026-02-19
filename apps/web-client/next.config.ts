import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
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
