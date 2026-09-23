import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ollama", "pdf-parse", "ora"],
  experimental: {
    // viewTransition: true,
  },
  typedRoutes: true,
  cacheComponents: true,
  cacheLife: {
    // Лента главной: попадает в prerender (expire ≥ 5 мин, stale ≥ 30 с),
    // при отсутствии изменений пересчитывается не чаще раза в минуту на курсор
    feed: { stale: 30, revalidate: 60, expire: 3600 },
  },
  partialPrefetching: true,
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
