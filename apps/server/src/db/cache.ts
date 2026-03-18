import { redis } from "./redis";

export async function getJsonCache<T>(key: string): Promise<T | null> {
  const value = await redis.get(key);
  if (!value) return null;
  return JSON.parse(value) as T;
}

export async function setJsonCache<T>(key: string, value: T, ttlSec: number): Promise<void> {
  await redis.set(key, JSON.stringify(value), { EX: ttlSec });
}

export async function delCache(key: string): Promise<void> {
  await redis.del(key);
}
