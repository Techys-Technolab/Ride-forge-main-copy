import { createClient } from "redis";
import { env } from "../config/env";

const client = createClient({
  url: env.redisUrl,
});

client.on("error", (err) => {
  console.error("Redis error", err);
});

export const redis = client;

export async function initRedis(): Promise<void> {
  if (!client.isOpen) {
    try {
      await client.connect();
      console.log("Redis connected");
    } catch (error) {
      console.warn("Redis unavailable. Continuing with in-memory fallback where supported.", error);
    }
  }
}
