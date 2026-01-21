const { spawn } = require("child_process");

const port = process.env.PORT || "3000";
const hostname = "0.0.0.0";

console.log(`Starting Next.js application...`);
console.log(`Port: ${port}`);
console.log(`Hostname: ${hostname}`);
console.log(`Environment: ${process.env.NODE_ENV || "production"}`);
console.log(`Node version: ${process.version}`);

const child = spawn(
  "node_modules/.bin/next",
  ["start", "-p", port, "-H", hostname],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: port,
      HOSTNAME: hostname,
      NODE_ENV: "production",
    },
    shell: true,
  },
);

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
