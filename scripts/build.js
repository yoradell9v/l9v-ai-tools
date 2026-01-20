const { execSync } = require("child_process");
const os = require("os");

console.log("=== Build Environment Info ===");
console.log("Node version:", process.version);
console.log("Platform:", process.platform);
console.log("CPU cores:", os.cpus().length);
console.log("Total memory:", Math.round(os.totalmem() / 1024 / 1024), "MB");
console.log("Free memory:", Math.round(os.freemem() / 1024 / 1024), "MB");
console.log("UV_THREADPOOL_SIZE:", process.env.UV_THREADPOOL_SIZE);
console.log("NEXT_PRIVATE_MAX_WORKERS:", process.env.NEXT_PRIVATE_MAX_WORKERS);
console.log("NEXT_PRIVATE_STATIC_WORKER_COUNT:", process.env.NEXT_PRIVATE_STATIC_WORKER_COUNT);
console.log("==============================\n");

try {
  console.log("Running Prisma generate...");
  execSync("npx prisma generate", { stdio: "inherit" });

  console.log("\nRunning Next.js build...");
  // Set environment variables before exec to ensure they're available
  process.env.UV_THREADPOOL_SIZE = "2";
  process.env.NEXT_PRIVATE_MAX_WORKERS = "1";
  process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || "") + " --max-old-space-size=1536";
  process.env.NEXT_TELEMETRY_DISABLED = "1";
  
  execSync("npx next build", {
    stdio: "inherit",
    env: {
      ...process.env,
      // Ensure these are set for the child process
      UV_THREADPOOL_SIZE: "2",
      NEXT_PRIVATE_MAX_WORKERS: "1",
      NODE_OPTIONS: process.env.NODE_OPTIONS,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });

  console.log("\n✓ Build completed!");
} catch (error) {
  console.error("\n✗ Build failed:", error.message);
  process.exit(1);
}
