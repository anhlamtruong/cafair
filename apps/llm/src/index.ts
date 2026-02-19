import "dotenv/config";
import app from "./app.js";
import { initRedis, closeRedis } from "./lib/redis.js";

const PORT = process.env.PORT || 3001;

async function main() {
  try {
    // Initialize optional Redis cache
    initRedis();

    // Start the server
    app.listen(PORT, () => {
      console.log(`🚀 LLM prompt service running on http://localhost:${PORT}`);
      console.log(
        `📋 Templates: GET http://localhost:${PORT}/api/prompt/templates`,
      );
      console.log(`🩺 Health:    GET http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM received — shutting down");
  await closeRedis();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("🛑 SIGINT received — shutting down");
  await closeRedis();
  process.exit(0);
});

main();
