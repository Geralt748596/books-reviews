import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ollama", "pdf-parse", "ora"],
  experimental: {
    viewTransition: true,
  },
  typedRoutes: true,
  cacheComponents: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "books.google.com",
      },
      {
        protocol: "https",
        hostname: "books.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;
