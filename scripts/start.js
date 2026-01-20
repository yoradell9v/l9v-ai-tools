#!/usr/bin/env node
const { spawn } = require("child_process");

console.log("🚀 Starting Next.js application...");

const child = spawn("next", ["start"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: process.env.PORT || "3000",
    NODE_ENV: "production",
  },
});

child.on("error", (error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

child.on("exit", (code) => {
  if (code !== 0) {
    console.error(`Server exited with code ${code}`);
    process.exit(code);
  }
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  child.kill("SIGTERM");
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  child.kill("SIGINT");
});
