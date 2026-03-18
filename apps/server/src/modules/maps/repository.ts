import { db } from "../../db/pg";

interface OfflinePackRow {
  id: string;
  user_id: string;
  name: string;
  min_lat: number;
  min_lng: number;
  max_lat: number;
  max_lng: number;
  tile_count_estimate: number;
  created_at: string;
}

export async function createOfflinePack(input: {
  userId: string;
  name: string;
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
  tileCountEstimate: number;
}): Promise<OfflinePackRow> {
  const result = await db.query<OfflinePackRow>(
    `INSERT INTO offline_map_packs (user_id, name, min_lat, min_lng, max_lat, max_lng, tile_count_estimate)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, user_id, name, min_lat, min_lng, max_lat, max_lng, tile_count_estimate, created_at`,
    [input.userId, input.name, input.minLat, input.minLng, input.maxLat, input.maxLng, input.tileCountEstimate],
  );
  return result.rows[0];
}

export async function listOfflinePacks(userId: string): Promise<OfflinePackRow[]> {
  const result = await db.query<OfflinePackRow>(
    `SELECT id, user_id, name, min_lat, min_lng, max_lat, max_lng, tile_count_estimate, created_at
       FROM offline_map_packs
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [userId],
  );
  return result.rows;
}
