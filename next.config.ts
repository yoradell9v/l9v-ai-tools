import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Increase timeout for static page generation
  staticPageGenerationTimeout: 120,
  
  ...(process.env.NODE_ENV === "production" && {
    experimental: {
      optimizePackageImports: ["lucide-react", "@heroicons/react"],
      workerThreads: false,
      // Limit parallel static page generation to prevent resource exhaustion
      staticGenerationMaxConcurrency: 1,
      staticGenerationMinPagesPerWorker: 1,
    },
  }),
};

export default nextConfig;
