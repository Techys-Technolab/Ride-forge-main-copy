import { NextFunction, Request, Response } from "express";
import { redis } from "../db/redis";

const memoryIdempotency = new Map<string, number>();

export function requireIdempotency(header = "idempotency-key") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.header(header);
    if (!key) {
      res.status(400).json({ message: `Missing ${header} header` });
      return;
    }

    const userId = req.auth?.userId ?? "anonymous";
    const storeKey = `idem:${userId}:${req.path}:${key}`;

    if (redis.isOpen) {
      const already = await redis.get(storeKey);
      if (already) {
        res.status(409).json({ message: "Duplicate request detected by idempotency key" });
        return;
      }
      await redis.set(storeKey, "1", { EX: 60 * 10 });
      next();
      return;
    }

    const now = Date.now();
    const exp = memoryIdempotency.get(storeKey);
    if (exp && exp > now) {
      res.status(409).json({ message: "Duplicate request detected by idempotency key" });
      return;
    }

    memoryIdempotency.set(storeKey, now + 10 * 60 * 1000);
    next();
  };
}
