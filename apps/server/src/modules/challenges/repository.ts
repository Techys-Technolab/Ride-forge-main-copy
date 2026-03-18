import { db } from "../../db/pg";

interface ChallengeRow {
  id: string;
  title: string;
  description: string;
  city?: string;
  state?: string;
  reward_points: number;
  starts_at: string;
  ends_at: string;
  dynamic_signal: string;
}

export async function ensureDynamicChallenges(city?: string, state?: string): Promise<void> {
  const now = new Date();
  const end = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const isNight = now.getHours() >= 19 || now.getHours() <= 5;

  const defaultChallenges: Array<{
    title: string;
    description: string;
    dynamicSignal: string;
    rewardPoints: number;
  }> = [
    {
      title: "Rain Safe Ride",
      description: "Complete a 50km safe ride with speed under 90km/h during weather advisory windows.",
      dynamicSignal: "weather-alert",
      rewardPoints: 30,
    },
    {
      title: "City Explorer",
      description: "Visit 3 waypoints in your current city and upload one ride story.",
      dynamicSignal: "city-discovery",
      rewardPoints: 20,
    },
  ];

  if (isWeekend) {
    defaultChallenges.push({
      title: "Weekend Endurance Run",
      description: "Complete 120km across at least 2 routes this weekend.",
      dynamicSignal: "weekend",
      rewardPoints: 40,
    });
  }

  if (isNight) {
    defaultChallenges.push({
      title: "Night Visibility Pro",
      description: "Complete a 40km night ride with at least one safety stop.",
      dynamicSignal: "night-ride",
      rewardPoints: 25,
    });
  }

  for (const challenge of defaultChallenges) {
    await db.query(
      `INSERT INTO challenges (title, description, city, state, reward_points, starts_at, ends_at, dynamic_signal)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8
       WHERE NOT EXISTS (
         SELECT 1 FROM challenges
          WHERE title = $1 AND dynamic_signal = $8 AND ends_at > NOW()
       )`,
      [challenge.title, challenge.description, city ?? null, state ?? null, challenge.rewardPoints, now.toISOString(), end.toISOString(), challenge.dynamicSignal],
    );
  }
}

export async function listActiveChallenges(city?: string, state?: string): Promise<ChallengeRow[]> {
  const result = await db.query<ChallengeRow>(
    `SELECT id, title, description, city, state, reward_points, starts_at, ends_at, dynamic_signal
       FROM challenges
      WHERE starts_at <= NOW()
        AND ends_at >= NOW()
        AND ($1::text IS NULL OR city IS NULL OR city = $1)
        AND ($2::text IS NULL OR state IS NULL OR state = $2)
      ORDER BY reward_points DESC`,
    [city ?? null, state ?? null],
  );

  return result.rows;
}

export async function getChallengeById(id: string): Promise<ChallengeRow | null> {
  const result = await db.query<ChallengeRow>(
    `SELECT id, title, description, city, state, reward_points, starts_at, ends_at, dynamic_signal
       FROM challenges WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function isChallengeCompleted(userId: string, challengeId: string): Promise<boolean> {
  const result = await db.query<{ completed: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM challenge_completions WHERE user_id = $1 AND challenge_id = $2) AS completed`,
    [userId, challengeId],
  );
  return Boolean(result.rows[0]?.completed);
}

export async function completeChallenge(input: { userId: string; challengeId: string }): Promise<void> {
  await db.query(
    `INSERT INTO challenge_completions (user_id, challenge_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, challenge_id) DO NOTHING`,
    [input.userId, input.challengeId],
  );
}
