import { db } from "../../db/pg";

export interface ProfileSummaryRow {
  id: string;
  display_name: string;
  email: string;
  phone?: string;
  role: string;
  account_type: "rider" | "club";
  rider_member_code?: string;
  club_member_code?: string;
  avatar_url?: string;
  city?: string;
  state?: string;
  country?: string;
  reward_points: number;
  ride_distance_total_km: string;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  onboarding_status: string;
}

export interface RiderProfileRow extends ProfileSummaryRow {
  full_name: string;
  blood_group: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  bike_models: string[];
  club_name?: string;
  is_solo_rider: boolean;
}

export interface ClubProfileRow extends ProfileSummaryRow {
  club_id: string;
  club_name: string;
  club_username: string;
  admin_name: string;
  about: string;
  logo_url?: string;
  facebook_url?: string;
  instagram_url?: string;
  identity_verification_status: "pending" | "verified" | "rejected";
  member_count: number;
}

export async function getProfileSummary(userId: string): Promise<ProfileSummaryRow | null> {
  const result = await db.query<ProfileSummaryRow>(
    `SELECT id, display_name, email, phone, role, account_type, rider_member_code, club_member_code, avatar_url,
            city, state, country, reward_points, ride_distance_total_km, is_email_verified, is_phone_verified, onboarding_status
       FROM users
      WHERE id = $1
      LIMIT 1`,
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function getRiderProfileDetails(userId: string): Promise<RiderProfileRow | null> {
  const result = await db.query<RiderProfileRow>(
    `SELECT u.id, u.display_name, u.email, u.phone, u.role, u.account_type, u.rider_member_code, u.club_member_code, u.avatar_url,
            u.city, u.state, u.country, u.reward_points, u.ride_distance_total_km, u.is_email_verified, u.is_phone_verified,
            u.onboarding_status, rp.full_name, rp.blood_group, rp.emergency_contact_name, rp.emergency_contact_phone,
            rp.bike_models, rp.club_name, rp.is_solo_rider
       FROM users u
       INNER JOIN rider_profiles rp ON rp.user_id = u.id
      WHERE u.id = $1
      LIMIT 1`,
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function getClubProfileDetails(ownerUserId: string): Promise<ClubProfileRow | null> {
  const result = await db.query<ClubProfileRow>(
    `SELECT u.id, u.display_name, u.email, u.phone, u.role, u.account_type, u.rider_member_code, u.club_member_code, u.avatar_url,
            u.city, u.state, u.country, u.reward_points, u.ride_distance_total_km, u.is_email_verified, u.is_phone_verified,
            u.onboarding_status, c.id AS club_id, c.club_name, c.club_username, c.admin_name, c.about, c.logo_url, c.facebook_url,
            c.instagram_url, c.identity_verification_status,
            (SELECT COUNT(*)::int FROM club_memberships cm WHERE cm.club_id = c.id AND cm.status = 'approved') AS member_count
       FROM users u
       INNER JOIN clubs c ON c.owner_user_id = u.id
      WHERE u.id = $1
      LIMIT 1`,
    [ownerUserId],
  );
  return result.rows[0] ?? null;
}

export async function updateRiderProfile(input: {
  userId: string;
  displayName: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  avatarUrl?: string;
  fullName: string;
  bloodGroup: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  bikeModels: string[];
  clubName?: string;
  isSoloRider: boolean;
}): Promise<RiderProfileRow> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE users
          SET display_name = $2,
              phone = $3,
              city = $4,
              state = $5,
              country = $6,
              avatar_url = $7
        WHERE id = $1`,
      [input.userId, input.displayName, input.phone, input.city, input.state, input.country, input.avatarUrl ?? null],
    );
    await client.query(
      `UPDATE rider_profiles
          SET full_name = $2,
              blood_group = $3,
              emergency_contact_name = $4,
              emergency_contact_phone = $5,
              bike_models = $6,
              club_name = $7,
              is_solo_rider = $8,
              updated_at = NOW()
        WHERE user_id = $1`,
      [
        input.userId,
        input.fullName,
        input.bloodGroup,
        input.emergencyContactName,
        input.emergencyContactPhone,
        input.bikeModels,
        input.isSoloRider ? null : input.clubName ?? null,
        input.isSoloRider,
      ],
    );
    const updated = await client.query<RiderProfileRow>(
      `SELECT u.id, u.display_name, u.email, u.phone, u.role, u.account_type, u.rider_member_code, u.club_member_code, u.avatar_url,
              u.city, u.state, u.country, u.reward_points, u.ride_distance_total_km, u.is_email_verified, u.is_phone_verified,
              u.onboarding_status, rp.full_name, rp.blood_group, rp.emergency_contact_name, rp.emergency_contact_phone,
              rp.bike_models, rp.club_name, rp.is_solo_rider
         FROM users u
         INNER JOIN rider_profiles rp ON rp.user_id = u.id
        WHERE u.id = $1
        LIMIT 1`,
      [input.userId],
    );
    await client.query("COMMIT");
    return updated.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateClubProfileByOwner(input: {
  userId: string;
  displayName: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  logoUrl?: string;
  clubName: string;
  adminName: string;
  about: string;
  facebookUrl?: string;
  instagramUrl?: string;
}): Promise<ClubProfileRow> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE users
          SET display_name = $2,
              phone = $3,
              city = $4,
              state = $5,
              country = $6,
              avatar_url = $7
        WHERE id = $1`,
      [input.userId, input.displayName, input.phone, input.city, input.state, input.country, input.logoUrl ?? null],
    );
    await client.query(
      `UPDATE clubs
          SET club_name = $2,
              admin_name = $3,
              about = $4,
              phone = $5,
              city = $6,
              state = $7,
              country = $8,
              logo_url = $9,
              facebook_url = $10,
              instagram_url = $11,
              updated_at = NOW()
        WHERE owner_user_id = $1`,
      [
        input.userId,
        input.clubName,
        input.adminName,
        input.about,
        input.phone,
        input.city,
        input.state,
        input.country,
        input.logoUrl ?? null,
        input.facebookUrl ?? null,
        input.instagramUrl ?? null,
      ],
    );
    const updated = await client.query<ClubProfileRow>(
      `SELECT u.id, u.display_name, u.email, u.phone, u.role, u.account_type, u.rider_member_code, u.club_member_code, u.avatar_url,
              u.city, u.state, u.country, u.reward_points, u.ride_distance_total_km, u.is_email_verified, u.is_phone_verified,
              u.onboarding_status, c.id AS club_id, c.club_name, c.club_username, c.admin_name, c.about, c.logo_url, c.facebook_url,
              c.instagram_url, c.identity_verification_status,
              (SELECT COUNT(*)::int FROM club_memberships cm WHERE cm.club_id = c.id AND cm.status = 'approved') AS member_count
         FROM users u
         INNER JOIN clubs c ON c.owner_user_id = u.id
        WHERE u.id = $1
        LIMIT 1`,
      [input.userId],
    );
    await client.query("COMMIT");
    return updated.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
