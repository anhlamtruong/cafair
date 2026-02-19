/**
 * Express App — LLM Prompt Service
 *
 * A focused API for structured AI interactions via optimized prompt templates.
 * No database — optional Redis caching layer only.
 */

import express from "express";
import cors from "cors";
import healthRouter from "./routes/health.js";
import promptRouter from "./routes/prompt.js";

const app = express();

// Middleware — 10mb limit for base64 image payloads
app.use(express.json({ limit: "10mb" }));
app.use(
  cors({
    origin: process.env.CORS_ORIGINS?.split(",") || ["http://localhost:3000"],
    credentials: true,
  }),
);

// Request logging (dev)
if (process.env.NODE_ENV === "development") {
  app.use((req, _res, next) => {
    console.log(`→ ${req.method} ${req.path}`);
    next();
  });
}

// Routes
app.use("/api/health", healthRouter);
app.use("/api/prompt", promptRouter);

// Error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("❌ Unhandled error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  },
);

export default app;
