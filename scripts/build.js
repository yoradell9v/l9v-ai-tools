const { execSync } = require("child_process");
const os = require("os");

console.log("=== Build Environment Info ===");
console.log("Node version:", process.version);
console.log("Platform:", process.platform);
console.log("CPU cores:", os.cpus().length);
console.log("Total memory:", Math.round(os.totalmem() / 1024 / 1024), "MB");
console.log("Free memory:", Math.round(os.freemem() / 1024 / 1024), "MB");
console.log("UV_THREADPOOL_SIZE:", process.env.UV_THREADPOOL_SIZE);
console.log("NEXT_BUILD_WORKERS:", process.env.NEXT_BUILD_WORKERS);
console.log("==============================\n");

try {
  console.log("Running Prisma generate...");
  execSync("npx prisma generate", { stdio: "inherit" });

  console.log("\nRunning Next.js build...");
  execSync("npx next build", {
    stdio: "inherit",
    env: {
      ...process.env,
      UV_THREADPOOL_SIZE: "2",
      NEXT_BUILD_WORKERS: "1", // This is the correct variable!
      NODE_OPTIONS: "--max-old-space-size=1536",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });

  console.log("\n✓ Build completed!");
} catch (error) {
  console.error("\n✗ Build failed:", error.message);
  process.exit(1);
}
