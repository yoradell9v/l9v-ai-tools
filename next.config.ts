import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Increase timeout for static page generation
  staticPageGenerationTimeout: 120,
  
  // Disable static optimization to prevent worker thread exhaustion
  // This will make all pages dynamic, which is safer for Railway's resource limits
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  
  ...(process.env.NODE_ENV === "production" && {
    experimental: {
      optimizePackageImports: ["lucide-react", "@heroicons/react"],
      workerThreads: false,
      // Limit parallel static page generation to prevent resource exhaustion
      staticGenerationMaxConcurrency: 1,
      staticGenerationMinPagesPerWorker: 1,
    },
  }),
  
  // Disable static page generation entirely to avoid worker thread issues
  // All pages will be rendered on-demand (SSR)
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
};

export default nextConfig;
