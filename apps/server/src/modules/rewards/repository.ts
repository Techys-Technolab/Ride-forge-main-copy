import { db } from "../../db/pg";

interface RewardBalanceRow {
  id: string;
  reward_points: number;
  ride_distance_total_km?: number;
  ride_reward_km_remainder?: number;
}

export async function getRewardBalance(userId: string): Promise<number> {
  const result = await db.query<RewardBalanceRow>(`SELECT id, reward_points FROM users WHERE id = $1 LIMIT 1`, [userId]);
  return Number(result.rows[0]?.reward_points ?? 0);
}

interface RideRewardProgress {
  rewardPoints: number;
  totalDistanceKm: number;
  remainderKm: number;
}

export async function getRideRewardProgress(userId: string): Promise<RideRewardProgress> {
  const result = await db.query<RewardBalanceRow>(
    `SELECT id, reward_points, ride_distance_total_km, ride_reward_km_remainder
       FROM users
      WHERE id = $1
      LIMIT 1`,
    [userId],
  );

  const row = result.rows[0];
  return {
    rewardPoints: Number(row?.reward_points ?? 0),
    totalDistanceKm: Number(row?.ride_distance_total_km ?? 0),
    remainderKm: Number(row?.ride_reward_km_remainder ?? 0),
  };
}

export async function applyRideDistanceRewards(input: {
  userId: string;
  distanceKm: number;
  rideId: string;
}): Promise<{ earnedPoints: number; balance: number; totalDistanceKm: number; remainderKm: number }> {
  const safeDistanceKm = Math.max(input.distanceKm, 0);

  const updated = await db.query<{
    reward_points: number;
    ride_distance_total_km: number;
    ride_reward_km_remainder: number;
    earned_points: number;
  }>(
    `WITH current AS (
       SELECT id,
              reward_points,
              ride_distance_total_km,
              ride_reward_km_remainder
         FROM users
        WHERE id = $1
        LIMIT 1
     ),
     calc AS (
       SELECT id,
              reward_points,
              ride_distance_total_km,
              ride_reward_km_remainder,
              FLOOR((COALESCE(ride_reward_km_remainder, 0) + $2) / 100)::int AS earned_points,
              MOD((COALESCE(ride_reward_km_remainder, 0) + $2), 100) AS next_remainder
         FROM current
     ),
     updated_user AS (
       UPDATE users u
          SET reward_points = u.reward_points + c.earned_points,
              ride_distance_total_km = COALESCE(u.ride_distance_total_km, 0) + $2,
              ride_reward_km_remainder = c.next_remainder
         FROM calc c
        WHERE u.id = c.id
        RETURNING u.reward_points, u.ride_distance_total_km, u.ride_reward_km_remainder, c.earned_points
     )
     SELECT reward_points, ride_distance_total_km, ride_reward_km_remainder, earned_points
       FROM updated_user`,
    [input.userId, safeDistanceKm],
  );

  const row = updated.rows[0];
  const earnedPoints = Number(row?.earned_points ?? 0);

  if (earnedPoints > 0) {
    await db.query(
      `INSERT INTO reward_transactions (user_id, points_delta, reason, metadata)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        input.userId,
        earnedPoints,
        "ride_completion",
        JSON.stringify({
          rideId: input.rideId,
          distanceKm: safeDistanceKm,
          rewardRate: "1_point_per_100_km",
          earnedPoints,
          remainderKm: Number(row?.ride_reward_km_remainder ?? 0),
        }),
      ],
    );
  }

  return {
    earnedPoints,
    balance: Number(row?.reward_points ?? 0),
    totalDistanceKm: Number(row?.ride_distance_total_km ?? 0),
    remainderKm: Number(row?.ride_reward_km_remainder ?? 0),
  };
}

export async function addRewardPoints(input: {
  userId: string;
  points: number;
  reason: string;
  metadata?: unknown;
}): Promise<number> {
  if (input.points <= 0) {
    return getRewardBalance(input.userId);
  }

  await db.query("BEGIN");
  try {
    await db.query(`UPDATE users SET reward_points = reward_points + $2 WHERE id = $1`, [input.userId, input.points]);
    await db.query(
      `INSERT INTO reward_transactions (user_id, points_delta, reason, metadata)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [input.userId, input.points, input.reason, JSON.stringify(input.metadata ?? {})],
    );
    const balance = await getRewardBalance(input.userId);
    await db.query("COMMIT");
    return balance;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}

export async function redeemRewardPoints(input: {
  userId: string;
  points: number;
  reason: string;
  metadata?: unknown;
}): Promise<{ ok: boolean; balance: number }> {
  if (input.points <= 0) {
    return { ok: true, balance: await getRewardBalance(input.userId) };
  }

  await db.query("BEGIN");
  try {
    const current = await getRewardBalance(input.userId);
    if (current < input.points) {
      await db.query("ROLLBACK");
      return { ok: false, balance: current };
    }

    await db.query(`UPDATE users SET reward_points = reward_points - $2 WHERE id = $1`, [input.userId, input.points]);
    await db.query(
      `INSERT INTO reward_transactions (user_id, points_delta, reason, metadata)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [input.userId, -input.points, input.reason, JSON.stringify(input.metadata ?? {})],
    );
    const balance = await getRewardBalance(input.userId);
    await db.query("COMMIT");
    return { ok: true, balance };
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}

interface RewardTransactionRow {
  id: string;
  user_id: string;
  points_delta: number;
  reason: string;
  metadata: unknown;
  created_at: string;
}

export async function listRewardTransactions(userId: string): Promise<RewardTransactionRow[]> {
  const result = await db.query<RewardTransactionRow>(
    `SELECT id, user_id, points_delta, reason, metadata, created_at
       FROM reward_transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100`,
    [userId],
  );
  return result.rows;
}
