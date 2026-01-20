import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  staticPageGenerationTimeout: 120,

  ...(process.env.NODE_ENV === "production" && {
    experimental: {
      optimizePackageImports: ["lucide-react", "@heroicons/react"],
      workerThreads: false,
      cpus: 1,
    },
  }),
  
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
};

export default nextConfig;