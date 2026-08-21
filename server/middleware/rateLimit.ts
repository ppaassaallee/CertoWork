import rateLimit from "express-rate-limit";
import type { Request } from "express";

export function createAiRateLimit() {
  return rateLimit({
    windowMs: 60_000,
    limit: 40,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => req.authUser?.uid || req.ip || "anonymous",
    message: {
      error: "Too many AI requests",
      code: "rate_limited",
    },
  });
}
