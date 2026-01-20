// Set these FIRST before any requires
process.env.UV_THREADPOOL_SIZE = "2";
process.env.NEXT_PRIVATE_WORKER_THREADS = "1";
process.env.NODE_OPTIONS = "--max-old-space-size=1536 --max-semi-space-size=64";

const { execSync } = require("child_process");
const os = require("os");

console.log("=== Build Environment Info ===");
console.log("Node version:", process.version);
console.log("Platform:", process.platform);
console.log("CPU cores:", os.cpus().length);
console.log("Total memory:", Math.round(os.totalmem() / 1024 / 1024), "MB");
console.log("Free memory:", Math.round(os.freemem() / 1024 / 1024), "MB");
console.log("UV_THREADPOOL_SIZE:", process.env.UV_THREADPOOL_SIZE);
console.log("NEXT_PRIVATE_WORKER_THREADS:", process.env.NEXT_PRIVATE_WORKER_THREADS);
console.log("==============================\n");

try {
  console.log("Running Prisma generate...");
  execSync("npx prisma generate", { 
    stdio: "inherit",
    env: {
      ...process.env,
    }
  });

  console.log("\nRunning Next.js build with limited workers...");
  execSync("NODE_OPTIONS='--max-old-space-size=1536' npx next build", {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      UV_THREADPOOL_SIZE: "2",
      NEXT_PRIVATE_WORKER_THREADS: "1",
      NEXT_TELEMETRY_DISABLED: "1",
      // Try these additional env vars
      WEB_CONCURRENCY: "1",
      NODE_ENV: "production",
    },
    maxBuffer: 1024 * 1024 * 10,
  });

  console.log("\n✓ Build completed successfully!");
} catch (error) {
  console.error("\n✗ Build failed:", error.message);
  console.error("Exit code:", error.status);
  process.exit(1);
}