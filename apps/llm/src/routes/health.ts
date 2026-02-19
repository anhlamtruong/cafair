/**
 * Health Check Route
 */

import { Router } from "express";
import { isRedisConnected } from "../lib/redis.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "llm-prompt-service",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    cache: {
      redis: isRedisConnected() ? "connected" : "disconnected (optional)",
    },
  });
});

export default router;
