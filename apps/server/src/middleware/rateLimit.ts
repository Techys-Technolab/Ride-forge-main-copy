import { NextFunction, Request, Response } from "express";
import { redis } from "../db/redis";

const memoryBucket = new Map<string, { count: number; expiresAt: number }>();

export function rateLimit(options: { keyPrefix: string; limit: number; windowSec: number }) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const key = `${options.keyPrefix}:${ip}`;
    const now = Date.now();
    let current = 0;

    if (redis.isOpen) {
      current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, options.windowSec);
      }
    } else {
      const existing = memoryBucket.get(key);
      if (!existing || existing.expiresAt < now) {
        memoryBucket.set(key, { count: 1, expiresAt: now + options.windowSec * 1000 });
        current = 1;
      } else {
        existing.count += 1;
        current = existing.count;
      }
    }

    res.setHeader("X-RateLimit-Limit", String(options.limit));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(options.limit - current, 0)));

    if (current > options.limit) {
      res.status(429).json({ message: "Too many requests" });
      return;
    }

    next();
  };
}
