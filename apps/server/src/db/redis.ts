import { createClient } from "redis";
import { env } from "../config/env";

const client = createClient({
  url: env.redisUrl,
  socket: {
    connectTimeout: 2000,
    reconnectStrategy: () => false,
  },
});

let redisErrorLogged = false;

client.on("error", (err) => {
  if (!redisErrorLogged) {
    console.warn("Redis unavailable. Continuing without Redis.", err);
    redisErrorLogged = true;
  }
});

export const redis = client;

export async function initRedis(): Promise<void> {
  if (!client.isOpen) {
    try {
      await client.connect();
      console.log("Redis connected");
    } catch {
      console.warn("Redis disabled for local run. In-memory / no-cache fallbacks remain active.");
    }
  }
}
