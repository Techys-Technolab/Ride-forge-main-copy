import { db } from "../../db/pg";

interface RideRow {
  id: string;
  user_id: string;
  distance_km: number;
  duration_sec: number;
  avg_speed_kmh: number;
  max_speed_kmh: number;
  started_at: string;
  ended_at?: string;
  points: unknown;
}

interface RideHistorySummaryRow {
  total_distance_km: number;
  total_duration_sec: number;
  ride_count: number;
}

export async function createRide(input: { userId: string; points: unknown[] }): Promise<RideRow> {
  const result = await db.query<RideRow>(
    `INSERT INTO rides (user_id, points, distance_km, duration_sec, avg_speed_kmh, max_speed_kmh, started_at)
     VALUES ($1, $2::jsonb, 0, 0, 0, 0, NOW())
     RETURNING id, user_id, distance_km, duration_sec, avg_speed_kmh, max_speed_kmh, started_at, ended_at, points`,
    [input.userId, JSON.stringify(input.points)],
  );
  return result.rows[0];
}

export async function stopRide(input: {
  id: string;
  userId: string;
  points: unknown[];
  distanceKm: number;
  durationSec: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
}): Promise<RideRow | null> {
  const result = await db.query<RideRow>(
    `UPDATE rides
       SET points = $3::jsonb,
           distance_km = $4,
           duration_sec = $5,
           avg_speed_kmh = $6,
           max_speed_kmh = $7,
           ended_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id, user_id, distance_km, duration_sec, avg_speed_kmh, max_speed_kmh, started_at, ended_at, points`,
    [input.id, input.userId, JSON.stringify(input.points), input.distanceKm, input.durationSec, input.avgSpeedKmh, input.maxSpeedKmh],
  );
  return result.rows[0] ?? null;
}

export async function getRide(id: string, userId: string): Promise<RideRow | null> {
  const result = await db.query<RideRow>(
    `SELECT id, user_id, distance_km, duration_sec, avg_speed_kmh, max_speed_kmh, started_at, ended_at, points
       FROM rides WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [id, userId],
  );
  return result.rows[0] ?? null;
}

export async function listRides(userId: string): Promise<RideRow[]> {
  const result = await db.query<RideRow>(
    `SELECT id, user_id, distance_km, duration_sec, avg_speed_kmh, max_speed_kmh, started_at, ended_at, points
       FROM rides WHERE user_id = $1 ORDER BY started_at DESC`,
    [userId],
  );
  return result.rows;
}

export async function getRideHistorySummary(userId: string): Promise<{
  totalDistanceKm: number;
  totalDurationSec: number;
  rideCount: number;
}> {
  const result = await db.query<RideHistorySummaryRow>(
    `SELECT COALESCE(SUM(distance_km), 0) AS total_distance_km,
            COALESCE(SUM(duration_sec), 0) AS total_duration_sec,
            COUNT(*)::int AS ride_count
       FROM rides
      WHERE user_id = $1`,
    [userId],
  );
  const row = result.rows[0];
  return {
    totalDistanceKm: Number(row?.total_distance_km ?? 0),
    totalDurationSec: Number(row?.total_duration_sec ?? 0),
    rideCount: Number(row?.ride_count ?? 0),
  };
}
