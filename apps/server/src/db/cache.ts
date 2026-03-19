import { redis } from "./redis";

export async function getJsonCache<T>(key: string): Promise<T | null> {
  if (!redis.isOpen) return null;

  try {
    const value = await redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn(`[cache] get failed for key ${key}`, error);
    return null;
  }
}

export async function setJsonCache<T>(key: string, value: T, ttlSec: number): Promise<void> {
  if (!redis.isOpen) return;

  try {
    await redis.set(key, JSON.stringify(value), { EX: ttlSec });
  } catch (error) {
    console.warn(`[cache] set failed for key ${key}`, error);
  }
}

export async function delCache(key: string): Promise<void> {
  if (!redis.isOpen) return;

  try {
    await redis.del(key);
  } catch (error) {
    console.warn(`[cache] delete failed for key ${key}`, error);
  }
}
