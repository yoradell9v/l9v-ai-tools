#!/usr/bin/env node
const { spawn } = require("child_process");

const port = process.env.PORT || "3000";
const hostname = process.env.HOSTNAME || "0.0.0.0";

console.log(`Starting Next.js application...`);
console.log(`Port: ${port}`);
console.log(`Hostname: ${hostname}`);
console.log(`Environment: ${process.env.NODE_ENV || "production"}`);

const child = spawn("next", ["start", "-H", hostname, "-p", port], {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: port,
    HOSTNAME: hostname,
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
