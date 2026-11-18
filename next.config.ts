import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "placehold.co" },
    ],
  },
  serverExternalPackages: ["@prisma/adapter-pg", "pg", "pino"],
  webpack(config) {
    // The embedded agent uses NodeNext-style .js import specifiers in TypeScript.
    // Resolve them to .ts sources when bundling server actions with webpack.
    config.resolve ??= {};
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
