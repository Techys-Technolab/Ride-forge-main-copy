import { db } from "../../db/pg";

export type DevicePlatform = "android" | "ios" | "web";

interface DeviceTokenRow {
  id: string;
  user_id: string;
  token: string;
  platform: DevicePlatform;
}

export async function upsertDeviceToken(input: {
  userId: string;
  token: string;
  platform: DevicePlatform;
}): Promise<void> {
  await db.query(
    `INSERT INTO user_device_tokens (user_id, token, platform)
     VALUES ($1, $2, $3)
     ON CONFLICT (token) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           platform = EXCLUDED.platform,
           updated_at = NOW()`,
    [input.userId, input.token, input.platform],
  );
}

export async function deleteDeviceToken(input: { userId: string; token: string }): Promise<void> {
  await db.query(`DELETE FROM user_device_tokens WHERE user_id = $1 AND token = $2`, [input.userId, input.token]);
}

export async function listDeviceTokensByUsers(userIds: string[]): Promise<DeviceTokenRow[]> {
  if (userIds.length === 0) return [];
  const result = await db.query<DeviceTokenRow>(
    `SELECT id, user_id, token, platform
       FROM user_device_tokens
      WHERE user_id = ANY($1::uuid[])`,
    [userIds],
  );
  return result.rows;
}

export async function deleteDeviceTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  await db.query(`DELETE FROM user_device_tokens WHERE token = ANY($1::text[])`, [tokens]);
}
