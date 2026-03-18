import { PoolClient } from "pg";
import { db } from "../../db/pg";

export type DbUserRole = "rider" | "club_admin" | "club_moderator" | "club_member" | "admin";
export type DbAccountType = "rider" | "club";
export type VerificationChannel = "email" | "phone";

export interface AuthUserRow {
  id: string;
  email: string;
  username?: string;
  phone?: string;
  password_hash: string;
  display_name: string;
  role: DbUserRole;
  account_type: DbAccountType;
  rider_member_code?: string;
  club_member_code?: string;
  avatar_url?: string;
  language: string;
  city?: string;
  state?: string;
  country?: string;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  onboarding_status: "pending_verification" | "active" | "suspended";
  reward_points: number;
}

interface VerificationRow {
  id: string;
  user_id: string;
  channel: VerificationChannel;
  target: string;
  code_hash: string;
  attempts: number;
  max_attempts: number;
  expires_at: string;
  verified_at?: string;
  last_sent_at: string;
}

interface PasswordResetRow {
  id: string;
  user_id: string;
  channel: VerificationChannel;
  target: string;
  code_hash: string;
  attempts: number;
  max_attempts: number;
  expires_at: string;
  consumed_at?: string;
  last_sent_at: string;
}

const USER_SELECT = `id, email, username, phone, password_hash, display_name, role, account_type,
  rider_member_code, club_member_code, avatar_url, language, city, state, country, is_email_verified,
  is_phone_verified, onboarding_status, reward_points`;

const clean = (value?: string): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const withTx = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export async function findUserByEmail(email: string): Promise<AuthUserRow | null> {
  const result = await db.query<AuthUserRow>(`SELECT ${USER_SELECT} FROM users WHERE email = $1 LIMIT 1`, [email]);
  return result.rows[0] ?? null;
}

export async function findUserByUsernameOrEmail(login: string): Promise<AuthUserRow | null> {
  const normalized = login.trim().toLowerCase();
  const result = await db.query<AuthUserRow>(
    `SELECT ${USER_SELECT}
       FROM users
      WHERE lower(email) = $1 OR lower(username) = $1
      LIMIT 1`,
    [normalized],
  );
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<AuthUserRow | null> {
  const result = await db.query<AuthUserRow>(`SELECT ${USER_SELECT} FROM users WHERE id = $1 LIMIT 1`, [id]);
  return result.rows[0] ?? null;
}

export async function findUserByPhone(phone: string): Promise<AuthUserRow | null> {
  const result = await db.query<AuthUserRow>(`SELECT ${USER_SELECT} FROM users WHERE phone = $1 LIMIT 1`, [phone]);
  return result.rows[0] ?? null;
}

export async function createRiderUser(input: {
  email: string;
  username: string;
  phone: string;
  passwordHash: string;
  displayName: string;
  avatarUrl?: string;
  language: string;
  city: string;
  state: string;
  country: string;
  fullName: string;
  bloodGroup: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  bikeModels: string[];
  clubName?: string;
  isSoloRider: boolean;
}): Promise<AuthUserRow> {
  return withTx(async (client) => {
    const riderCode = await nextRideforgeCode(client, "RFR");
    const userResult = await client.query<AuthUserRow>(
      `INSERT INTO users (
         email, username, phone, password_hash, display_name, role, account_type,
         rider_member_code, avatar_url, language, city, state, country, onboarding_status
       )
       VALUES ($1,$2,$3,$4,$5,'rider','rider',$6,$7,$8,$9,$10,$11,'pending_verification')
       RETURNING ${USER_SELECT}`,
      [
        input.email.toLowerCase(),
        input.username.toLowerCase(),
        input.phone,
        input.passwordHash,
        input.displayName,
        riderCode,
        clean(input.avatarUrl),
        input.language,
        input.city,
        input.state,
        input.country,
      ],
    );
    const user = userResult.rows[0];
    await client.query(
      `INSERT INTO rider_profiles (
         user_id, full_name, blood_group, emergency_contact_name, emergency_contact_phone,
         bike_models, club_name, is_solo_rider
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        user.id,
        input.fullName,
        input.bloodGroup,
        input.emergencyContactName,
        input.emergencyContactPhone,
        input.bikeModels,
        input.isSoloRider ? null : clean(input.clubName),
        input.isSoloRider,
      ],
    );
    return user;
  });
}

export async function createClubUser(input: {
  email: string;
  username: string;
  phone: string;
  passwordHash: string;
  displayName: string;
  avatarUrl?: string;
  language: string;
  city: string;
  state: string;
  country: string;
  clubName: string;
  adminName: string;
  about: string;
  facebookUrl?: string;
  instagramUrl?: string;
}): Promise<AuthUserRow> {
  return withTx(async (client) => {
    const clubCode = await nextRideforgeCode(client, "RFC");
    const userResult = await client.query<AuthUserRow>(
      `INSERT INTO users (
         email, username, phone, password_hash, display_name, role, account_type,
         club_member_code, avatar_url, language, city, state, country, onboarding_status
       )
       VALUES ($1,$2,$3,$4,$5,'club_admin','club',$6,$7,$8,$9,$10,$11,'pending_verification')
       RETURNING ${USER_SELECT}`,
      [
        input.email.toLowerCase(),
        input.username.toLowerCase(),
        input.phone,
        input.passwordHash,
        input.displayName,
        clubCode,
        clean(input.avatarUrl),
        input.language,
        input.city,
        input.state,
        input.country,
      ],
    );
    const user = userResult.rows[0];

    const clubResult = await client.query<{ id: string }>(
      `INSERT INTO clubs (
        owner_user_id, club_code, club_name, club_username, admin_name, about, logo_url, phone,
        city, state, country, facebook_url, instagram_url
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id`,
      [
        user.id,
        clubCode,
        input.clubName,
        input.username.toLowerCase(),
        input.adminName,
        input.about,
        clean(input.avatarUrl),
        input.phone,
        input.city,
        input.state,
        input.country,
        clean(input.facebookUrl),
        clean(input.instagramUrl),
      ],
    );
    const clubId = clubResult.rows[0].id;

    await client.query(
      `INSERT INTO club_memberships (club_id, user_id, role, status, requested_at, reviewed_at, updated_at)
       VALUES ($1,$2,'admin','approved', NOW(), NOW(), NOW())`,
      [clubId, user.id],
    );

    return user;
  });
}

export async function createOrUpdateVerificationCode(input: {
  userId: string;
  channel: VerificationChannel;
  target: string;
  codeHash: string;
  expiresAt: string;
}): Promise<void> {
  await db.query(
    `INSERT INTO verification_codes (user_id, channel, target, code_hash, attempts, max_attempts, expires_at, last_sent_at, verified_at, updated_at)
     VALUES ($1,$2,$3,$4,0,5,$5,NOW(),NULL,NOW())
     ON CONFLICT (user_id, channel) DO UPDATE
       SET target = EXCLUDED.target,
           code_hash = EXCLUDED.code_hash,
           attempts = 0,
           expires_at = EXCLUDED.expires_at,
           last_sent_at = NOW(),
           verified_at = NULL,
           updated_at = NOW()`,
    [input.userId, input.channel, input.target, input.codeHash, input.expiresAt],
  );
}

export async function createOrUpdatePasswordResetCode(input: {
  userId: string;
  channel: VerificationChannel;
  target: string;
  codeHash: string;
  expiresAt: string;
}): Promise<void> {
  await db.query(
    `INSERT INTO password_reset_codes (user_id, channel, target, code_hash, attempts, max_attempts, expires_at, consumed_at, last_sent_at, updated_at)
     VALUES ($1,$2,$3,$4,0,5,$5,NULL,NOW(),NOW())
     ON CONFLICT (user_id, channel) DO UPDATE
       SET target = EXCLUDED.target,
           code_hash = EXCLUDED.code_hash,
           attempts = 0,
           expires_at = EXCLUDED.expires_at,
           consumed_at = NULL,
           last_sent_at = NOW(),
           updated_at = NOW()`,
    [input.userId, input.channel, input.target, input.codeHash, input.expiresAt],
  );
}

export async function findVerificationCode(userId: string, channel: VerificationChannel): Promise<VerificationRow | null> {
  const result = await db.query<VerificationRow>(
    `SELECT id, user_id, channel, target, code_hash, attempts, max_attempts, expires_at, verified_at, last_sent_at
       FROM verification_codes
      WHERE user_id = $1 AND channel = $2
      LIMIT 1`,
    [userId, channel],
  );
  return result.rows[0] ?? null;
}

export async function findPasswordResetCode(userId: string, channel: VerificationChannel): Promise<PasswordResetRow | null> {
  const result = await db.query<PasswordResetRow>(
    `SELECT id, user_id, channel, target, code_hash, attempts, max_attempts, expires_at, consumed_at, last_sent_at
       FROM password_reset_codes
      WHERE user_id = $1 AND channel = $2
      LIMIT 1`,
    [userId, channel],
  );
  return result.rows[0] ?? null;
}

export async function recordVerificationAttempt(id: string): Promise<void> {
  await db.query(`UPDATE verification_codes SET attempts = attempts + 1, updated_at = NOW() WHERE id = $1`, [id]);
}

export async function recordPasswordResetAttempt(id: string): Promise<void> {
  await db.query(`UPDATE password_reset_codes SET attempts = attempts + 1, updated_at = NOW() WHERE id = $1`, [id]);
}

export async function updateUserPassword(input: { userId: string; passwordHash: string }): Promise<void> {
  await db.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [input.userId, input.passwordHash]);
}

export async function consumePasswordResetCode(id: string): Promise<void> {
  await db.query(`UPDATE password_reset_codes SET consumed_at = NOW(), updated_at = NOW() WHERE id = $1`, [id]);
}

export async function markChannelVerified(input: { userId: string; channel: VerificationChannel }): Promise<void> {
  await withTx(async (client) => {
    await client.query(
      `UPDATE verification_codes SET verified_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND channel = $2`,
      [input.userId, input.channel],
    );
    if (input.channel === "email") {
      await client.query(`UPDATE users SET is_email_verified = TRUE WHERE id = $1`, [input.userId]);
    } else {
      await client.query(`UPDATE users SET is_phone_verified = TRUE WHERE id = $1`, [input.userId]);
    }
    await client.query(
      `UPDATE users
          SET onboarding_status = CASE WHEN is_email_verified = TRUE AND is_phone_verified = TRUE THEN 'active' ELSE onboarding_status END
        WHERE id = $1`,
      [input.userId],
    );
  });
}

export async function listPublicClubs(input: {
  query?: string;
  city?: string;
  state?: string;
  country?: string;
  sort?: "popularity" | "activity" | "newest";
  viewerUserId?: string;
}): Promise<
  Array<{
    id: string;
    club_code: string;
    club_name: string;
    about: string;
    logo_url?: string;
    city: string;
    state: string;
    country: string;
    facebook_url?: string;
    instagram_url?: string;
    member_count: number;
    activity_count: number;
    join_status?: "pending" | "approved" | "rejected";
  }>
> {
  const sortClause =
    input.sort === "activity"
      ? "activity_count DESC, member_count DESC, c.created_at DESC"
      : input.sort === "newest"
        ? "c.created_at DESC"
        : "member_count DESC, activity_count DESC, c.created_at DESC";

  const result = await db.query(
    `SELECT c.id, c.club_code, c.club_name, c.about, c.logo_url, c.city, c.state, c.country, c.facebook_url, c.instagram_url,
            COALESCE(m.member_count, 0)::int AS member_count,
            COALESCE(a.activity_count, 0)::int AS activity_count,
            cm.status AS join_status
       FROM clubs c
       LEFT JOIN (
         SELECT club_id, COUNT(*) AS member_count
         FROM club_memberships
         WHERE status = 'approved'
         GROUP BY club_id
       ) m ON m.club_id = c.id
       LEFT JOIN (
         SELECT c2.id AS club_id, COUNT(e.id) AS activity_count
         FROM clubs c2
         LEFT JOIN events e ON e.host_id = c2.owner_user_id AND e.start_at >= NOW() - INTERVAL '30 days'
         GROUP BY c2.id
       ) a ON a.club_id = c.id
       LEFT JOIN club_memberships cm ON cm.club_id = c.id AND cm.user_id = $5
      WHERE c.is_active = TRUE
        AND ($1::text IS NULL OR c.club_name ILIKE '%' || $1 || '%' OR c.about ILIKE '%' || $1 || '%')
        AND ($2::text IS NULL OR c.city = $2)
        AND ($3::text IS NULL OR c.state = $3)
        AND ($4::text IS NULL OR c.country = $4)
      ORDER BY ${sortClause}
      LIMIT 100`,
    [clean(input.query), clean(input.city), clean(input.state), clean(input.country), input.viewerUserId ?? null],
  );
  return result.rows as Array<{
    id: string;
    club_code: string;
    club_name: string;
    about: string;
    logo_url?: string;
    city: string;
    state: string;
    country: string;
    facebook_url?: string;
    instagram_url?: string;
    member_count: number;
    activity_count: number;
    join_status?: "pending" | "approved" | "rejected";
  }>;
}

export async function searchRiders(input: {
  query?: string;
  city?: string;
  state?: string;
  excludeUserId: string;
  limit?: number;
}): Promise<Array<Pick<AuthUserRow, "id" | "display_name" | "city" | "state">>> {
  const result = await db.query<Pick<AuthUserRow, "id" | "display_name" | "city" | "state">>(
    `SELECT id, display_name, city, state
       FROM users
      WHERE account_type = 'rider'
        AND onboarding_status = 'active'
        AND id <> $1
        AND ($2::text IS NULL OR display_name ILIKE '%' || $2 || '%')
        AND ($3::text IS NULL OR city = $3)
        AND ($4::text IS NULL OR state = $4)
      ORDER BY display_name ASC
      LIMIT $5`,
    [input.excludeUserId, input.query ?? null, input.city ?? null, input.state ?? null, input.limit ?? 25],
  );
  return result.rows;
}

async function nextRideforgeCode(client: PoolClient, prefix: "RFR" | "RFC"): Promise<string> {
  const year = new Date().getUTCFullYear();
  const result = await client.query<{ next_value: number }>(
    `INSERT INTO id_counters (id_type, seq_year, next_value)
     VALUES ($1, $2, 2)
     ON CONFLICT (id_type, seq_year)
     DO UPDATE SET next_value = id_counters.next_value + 1
     RETURNING next_value - 1 AS next_value`,
    [prefix, year],
  );
  const seq = String(result.rows[0].next_value).padStart(6, "0");
  return `${prefix}-${year}-${seq}`;
}
