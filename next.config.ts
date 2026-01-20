import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  
  ...(process.env.NODE_ENV === "production" && {
    experimental: {
      optimizePackageImports: ["lucide-react", "@heroicons/react"],
      workerThreads: false,
    },
  }),
};

export default nextConfig;
