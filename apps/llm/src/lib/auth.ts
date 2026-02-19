/**
 * Service Token Auth Middleware
 *
 * Validates X-Service-Token header on incoming requests.
 * The tRPC service sends this token to authenticate inter-service calls.
 * In development/mock mode, the middleware is permissive if no token is configured.
 */

import { Request, Response, NextFunction } from "express";

/**
 * Creates middleware that validates the X-Service-Token header.
 * If LLM_SERVICE_TOKEN env var is not set, allows all requests (dev mode).
 */
export function requireServiceToken() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const expectedToken = process.env.LLM_SERVICE_TOKEN;

    // If no token configured, skip auth (dev mode)
    if (!expectedToken) {
      next();
      return;
    }

    const providedToken = req.headers["x-service-token"];

    if (!providedToken || providedToken !== expectedToken) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Invalid or missing X-Service-Token header",
      });
      return;
    }

    next();
  };
}
