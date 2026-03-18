import { redis } from "../../db/redis";

const PREFIX = "refresh:";

export async function saveRefreshSession(token: string, userId: string): Promise<void> {
  await redis.set(`${PREFIX}${token}`, userId, { EX: 60 * 60 * 24 * 30 });
}

export async function hasRefreshSession(token: string): Promise<boolean> {
  const value = await redis.get(`${PREFIX}${token}`);
  return !!value;
}
