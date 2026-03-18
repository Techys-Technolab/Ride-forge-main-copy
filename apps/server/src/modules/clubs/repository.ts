import { db } from "../../db/pg";

type MembershipStatus = "pending" | "approved" | "rejected" | "cancelled";
type MembershipRole = "admin" | "moderator" | "member";

export interface ClubRow {
  id: string;
  owner_user_id: string;
  club_code: string;
  club_name: string;
  club_username: string;
  admin_name: string;
  about: string;
  logo_url?: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  facebook_url?: string;
  instagram_url?: string;
  identity_verification_status: "pending" | "verified" | "rejected";
}

export interface ClubListRow {
  id: string;
  club_code: string;
  club_name: string;
  club_username: string;
  admin_name: string;
  about: string;
  logo_url?: string;
  city: string;
  state: string;
  country: string;
  facebook_url?: string;
  instagram_url?: string;
  member_count: number;
  activity_count: number;
  join_status?: MembershipStatus;
}

export interface MembershipRow {
  id: string;
  club_id: string;
  user_id: string;
  role: MembershipRole;
  status: MembershipStatus;
  requested_at: string;
  reviewed_at?: string;
}

export interface PendingMembershipRequestRow {
  id: string;
  club_id: string;
  user_id: string;
  status: MembershipStatus;
  requested_at: string;
  display_name: string;
  email: string;
  phone?: string;
  club_name: string;
}

export interface ClubProfileUpdateRow {
  id: string;
  club_code: string;
  club_name: string;
  admin_name: string;
  about: string;
  city: string;
  state: string;
  country: string;
  facebook_url?: string;
  instagram_url?: string;
  logo_url?: string;
}

const clean = (value?: string): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export async function isClubNameTaken(clubName: string): Promise<boolean> {
  const result = await db.query<{ exists: boolean }>(`SELECT EXISTS(SELECT 1 FROM clubs WHERE lower(club_name) = lower($1))`, [
    clubName,
  ]);
  return result.rows[0]?.exists ?? false;
}

export async function getClubByOwnerUserId(ownerUserId: string): Promise<ClubRow | null> {
  const result = await db.query<ClubRow>(`SELECT * FROM clubs WHERE owner_user_id = $1 LIMIT 1`, [ownerUserId]);
  return result.rows[0] ?? null;
}

export async function getClubById(clubId: string): Promise<ClubRow | null> {
  const result = await db.query<ClubRow>(`SELECT * FROM clubs WHERE id = $1 LIMIT 1`, [clubId]);
  return result.rows[0] ?? null;
}

export async function listClubs(input: {
  query?: string;
  city?: string;
  state?: string;
  country?: string;
  sort?: "popularity" | "activity" | "newest";
  viewerUserId?: string;
}): Promise<ClubListRow[]> {
  const sortClause =
    input.sort === "activity"
      ? "activity_count DESC, member_count DESC, c.created_at DESC"
      : input.sort === "newest"
        ? "c.created_at DESC"
        : "member_count DESC, activity_count DESC, c.created_at DESC";

  const result = await db.query<ClubListRow>(
    `SELECT c.id, c.club_code, c.club_name, c.club_username, c.admin_name, c.about, c.logo_url, c.city, c.state, c.country,
            c.facebook_url, c.instagram_url,
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
  return result.rows;
}

export async function getMembership(clubId: string, userId: string): Promise<MembershipRow | null> {
  const result = await db.query<MembershipRow>(
    `SELECT id, club_id, user_id, role, status, requested_at, reviewed_at
       FROM club_memberships
      WHERE club_id = $1 AND user_id = $2
      LIMIT 1`,
    [clubId, userId],
  );
  return result.rows[0] ?? null;
}

export async function requestJoinClub(clubId: string, userId: string): Promise<MembershipRow> {
  const existing = await getMembership(clubId, userId);
  if (existing && (existing.status === "approved" || existing.status === "pending")) {
    return existing;
  }

  const result = await db.query<MembershipRow>(
    `INSERT INTO club_memberships (club_id, user_id, role, status)
     VALUES ($1,$2,'member','pending')
     ON CONFLICT (club_id, user_id)
     DO UPDATE SET status = 'pending', role = 'member', reviewed_by = NULL, review_note = NULL, reviewed_at = NULL, updated_at = NOW()
     RETURNING id, club_id, user_id, role, status, requested_at, reviewed_at`,
    [clubId, userId],
  );
  return result.rows[0];
}

export async function cancelJoinRequest(clubId: string, userId: string): Promise<boolean> {
  const result = await db.query(
    `UPDATE club_memberships
        SET status = 'cancelled', updated_at = NOW()
      WHERE club_id = $1 AND user_id = $2 AND status = 'pending'`,
    [clubId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listPendingRequestsForAdmin(adminUserId: string): Promise<PendingMembershipRequestRow[]> {
  const result = await db.query<PendingMembershipRequestRow>(
    `SELECT cm.id, cm.club_id, cm.user_id, cm.status, cm.requested_at, u.display_name, u.email, u.phone, c.club_name
       FROM club_memberships cm
       INNER JOIN clubs c ON c.id = cm.club_id
       INNER JOIN users u ON u.id = cm.user_id
      WHERE cm.status = 'pending'
        AND EXISTS (
          SELECT 1 FROM club_memberships adm
          WHERE adm.club_id = cm.club_id
            AND adm.user_id = $1
            AND adm.status = 'approved'
            AND adm.role IN ('admin','moderator')
        )
      ORDER BY cm.requested_at ASC`,
    [adminUserId],
  );
  return result.rows;
}

export async function reviewJoinRequest(input: {
  clubId: string;
  userId: string;
  reviewerUserId: string;
  approve: boolean;
  reviewNote?: string;
}): Promise<MembershipRow | null> {
  const status: MembershipStatus = input.approve ? "approved" : "rejected";
  const result = await db.query<MembershipRow>(
    `UPDATE club_memberships
        SET status = $4,
            reviewed_by = $3,
            review_note = $5,
            reviewed_at = NOW(),
            updated_at = NOW()
      WHERE club_id = $1
        AND user_id = $2
        AND status = 'pending'
      RETURNING id, club_id, user_id, role, status, requested_at, reviewed_at`,
    [input.clubId, input.userId, input.reviewerUserId, status, clean(input.reviewNote)],
  );
  return result.rows[0] ?? null;
}

export async function removeMember(input: { clubId: string; userId: string; actorUserId: string }): Promise<boolean> {
  const result = await db.query(
    `UPDATE club_memberships
        SET status = 'cancelled',
            reviewed_by = $3,
            review_note = 'Removed by admin',
            reviewed_at = NOW(),
            updated_at = NOW()
      WHERE club_id = $1
        AND user_id = $2
        AND status = 'approved'
        AND role <> 'admin'`,
    [input.clubId, input.userId, input.actorUserId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function isClubAdminOrModerator(clubId: string, userId: string): Promise<boolean> {
  const result = await db.query<{ ok: boolean }>(
    `SELECT EXISTS(
      SELECT 1
        FROM club_memberships
       WHERE club_id = $1
         AND user_id = $2
         AND status = 'approved'
         AND role IN ('admin','moderator')
    ) AS ok`,
    [clubId, userId],
  );
  return result.rows[0]?.ok ?? false;
}

export async function updateClubProfile(input: {
  clubId: string;
  about?: string;
  city?: string;
  state?: string;
  country?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  logoUrl?: string;
}): Promise<ClubProfileUpdateRow | null> {
  const result = await db.query<ClubProfileUpdateRow>(
    `UPDATE clubs
        SET about = COALESCE($2, about),
            city = COALESCE($3, city),
            state = COALESCE($4, state),
            country = COALESCE($5, country),
            facebook_url = COALESCE($6, facebook_url),
            instagram_url = COALESCE($7, instagram_url),
            logo_url = COALESCE($8, logo_url),
            updated_at = NOW()
      WHERE id = $1
      RETURNING id, club_code, club_name, admin_name, about, city, state, country, facebook_url, instagram_url, logo_url`,
    [
      input.clubId,
      clean(input.about),
      clean(input.city),
      clean(input.state),
      clean(input.country),
      clean(input.facebookUrl),
      clean(input.instagramUrl),
      clean(input.logoUrl),
    ],
  );
  return result.rows[0] ?? null;
}

export async function deactivateClubAndReassignRiders(
  clubId: string,
  actorUserId: string,
): Promise<{ ok: boolean; affectedRiderIds: string[] }> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const allowed = await client.query<{ ok: boolean }>(
      `SELECT EXISTS(
         SELECT 1
         FROM club_memberships
         WHERE club_id = $1
           AND user_id = $2
           AND role = 'admin'
           AND status = 'approved'
      ) AS ok`,
      [clubId, actorUserId],
    );
    if (!allowed.rows[0]?.ok) {
      await client.query("ROLLBACK");
      return { ok: false, affectedRiderIds: [] };
    }

    const affected = await client.query<{ user_id: string }>(
      `SELECT cm.user_id
         FROM club_memberships cm
         INNER JOIN users u ON u.id = cm.user_id
        WHERE cm.club_id = $1
          AND cm.status = 'approved'
          AND u.account_type = 'rider'`,
      [clubId],
    );
    const affectedRiderIds = affected.rows.map((row: { user_id: string }) => row.user_id);

    await client.query(
      `UPDATE rider_profiles rp
          SET is_solo_rider = TRUE,
              club_name = NULL,
              updated_at = NOW()
        WHERE rp.user_id IN (
          SELECT cm.user_id
            FROM club_memberships cm
            INNER JOIN users u ON u.id = cm.user_id
           WHERE cm.club_id = $1
             AND cm.status = 'approved'
             AND u.account_type = 'rider'
        )`,
      [clubId],
    );

    await client.query(
      `UPDATE club_memberships
          SET status = 'cancelled',
              reviewed_by = $2,
              review_note = 'Club archived',
              reviewed_at = NOW(),
              updated_at = NOW()
        WHERE club_id = $1
          AND status IN ('pending', 'approved')`,
      [clubId, actorUserId],
    );

    const clubUpdate = await client.query(
      `UPDATE clubs
          SET is_active = FALSE,
              updated_at = NOW()
        WHERE id = $1`,
      [clubId],
    );

    await client.query("COMMIT");
    return { ok: (clubUpdate.rowCount ?? 0) > 0, affectedRiderIds };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
