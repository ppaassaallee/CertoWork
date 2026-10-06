import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

export function createAiRateLimit() {
  return rateLimit({
    windowMs: 60_000,
    limit: 40,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => req.authUser?.uid || ipKeyGenerator(req.ip || "0.0.0.0"),
    message: {
      error: "Too many AI requests",
      code: "rate_limited",
    },
  });
}
