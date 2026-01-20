process.env.UV_THREADPOOL_SIZE = "2";
process.env.NEXT_PRIVATE_WORKER_THREADS = "1";
process.env.NODE_OPTIONS = "--max-old-space-size=1536 --max-semi-space-size=64";

import { execSync } from "child_process";

try {
  console.log("Running Prisma generate...");
  execSync("npm run prisma:generate --production=false", { stdio: "inherit" });

  console.log("Running Next.js build with limited workers...");
  execSync("next build", {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PRIVATE_WORKER_THREADS: "1",
      UV_THREADPOOL_SIZE: "2",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    maxBuffer: 1024 * 1024 * 10,
  });

  console.log("Build completed successfully!");
} catch (error) {
  console.error("Build failed:", error.message);
  process.exit(1);
}
