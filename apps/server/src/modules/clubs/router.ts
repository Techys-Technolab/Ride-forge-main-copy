import { Router } from "express";
import { z } from "zod";
import { authGuard } from "../../middleware/auth";
import { findUserById } from "../auth/repository";
import { sendPushToUsersSafe } from "../notifications/service";
import { getIoServer } from "../realtime/gateway";
import {
  cancelJoinRequest,
  deactivateClubAndReassignRiders,
  getClubById,
  getClubByOwnerUserId,
  getMembership,
  isClubAdminOrModerator,
  listClubs,
  listPendingRequestsForAdmin,
  removeMember,
  requestJoinClub,
  reviewJoinRequest,
  updateClubProfile,
  type ClubListRow,
  type PendingMembershipRequestRow,
} from "./repository";

const reviewSchema = z.object({
  userId: z.string().uuid(),
  approve: z.boolean(),
  reviewNote: z.string().max(240).optional(),
});

const updateClubSchema = z.object({
  about: z.string().min(10).max(1000).optional(),
  city: z.string().min(2).max(80).optional(),
  state: z.string().min(2).max(80).optional(),
  country: z.string().min(2).max(80).optional(),
  facebookUrl: z.string().url().optional(),
  instagramUrl: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
});

export const clubsRouter = Router();
clubsRouter.use(authGuard);

clubsRouter.get("/", async (req, res) => {
  const query = req.query.q ? String(req.query.q) : undefined;
  const city = req.query.city ? String(req.query.city) : undefined;
  const state = req.query.state ? String(req.query.state) : undefined;
  const country = req.query.country ? String(req.query.country) : undefined;
  const sort = req.query.sort === "activity" || req.query.sort === "newest" ? req.query.sort : "popularity";

  const rows = await listClubs({
    query,
    city,
    state,
    country,
    sort,
    viewerUserId: req.auth!.userId,
  });

  res.json(
    rows.map((row: ClubListRow) => ({
      id: row.id,
      clubCode: row.club_code,
      clubName: row.club_name,
      clubUsername: row.club_username,
      adminName: row.admin_name,
      about: row.about,
      logoUrl: row.logo_url,
      city: row.city,
      state: row.state,
      country: row.country,
      facebookUrl: row.facebook_url,
      instagramUrl: row.instagram_url,
      memberCount: Number(row.member_count ?? 0),
      activityCount: Number(row.activity_count ?? 0),
      joinStatus: row.join_status,
    })),
  );
});

clubsRouter.get("/my/requests", async (req, res) => {
  const rows = await listPendingRequestsForAdmin(req.auth!.userId);
  res.json(
    rows.map((row: PendingMembershipRequestRow) => ({
      id: row.id,
      clubId: row.club_id,
      clubName: row.club_name,
      userId: row.user_id,
      displayName: row.display_name,
      email: row.email,
      phone: row.phone,
      status: row.status,
      requestedAt: row.requested_at,
    })),
  );
});

clubsRouter.post("/:clubId/join", async (req, res) => {
  const user = await findUserById(req.auth!.userId);
  if (!user || user.account_type !== "rider") {
    res.status(403).json({ message: "Only rider accounts can send join requests" });
    return;
  }

  const club = await getClubById(req.params.clubId);
  if (!club) {
    res.status(404).json({ message: "Club not found" });
    return;
  }

  const existing = await getMembership(club.id, req.auth!.userId);
  const membership = await requestJoinClub(club.id, req.auth!.userId);
  if (membership.status === "approved" || (existing && existing.status === "pending")) {
    res.status(200).json({
      clubId: membership.club_id,
      userId: membership.user_id,
      status: membership.status,
      requestedAt: membership.requested_at,
    });
    return;
  }
  await sendPushToUsersSafe({
    userIds: [club.owner_user_id],
    title: "New club join request",
    body: `${user.display_name} requested to join ${club.club_name}`,
    data: { type: "club_join_request", clubId: club.id, userId: req.auth!.userId },
  });
  getIoServer()?.emit("club:join-request", { clubId: club.id, userId: req.auth!.userId, status: membership.status });

  res.status(201).json({
    clubId: membership.club_id,
    userId: membership.user_id,
    status: membership.status,
    requestedAt: membership.requested_at,
  });
});

clubsRouter.post("/:clubId/cancel", async (req, res) => {
  const ok = await cancelJoinRequest(req.params.clubId, req.auth!.userId);
  if (!ok) {
    res.status(409).json({ message: "No pending request to cancel" });
    return;
  }
  const [club, user] = await Promise.all([getClubById(req.params.clubId), findUserById(req.auth!.userId)]);
  if (club) {
    await sendPushToUsersSafe({
      userIds: [club.owner_user_id],
      title: "Join request cancelled",
      body: `${user?.display_name ?? "A rider"} cancelled their request to join ${club.club_name}.`,
      data: { type: "club_join_cancelled", clubId: club.id, userId: req.auth!.userId },
    });
  }
  res.json({ message: "Join request cancelled", status: "cancelled" });
});

clubsRouter.post("/:clubId/review", async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const allowed = await isClubAdminOrModerator(req.params.clubId, req.auth!.userId);
  if (!allowed) {
    res.status(403).json({ message: "Only club admin/moderator can review requests" });
    return;
  }

  const reviewed = await reviewJoinRequest({
    clubId: req.params.clubId,
    userId: parsed.data.userId,
    reviewerUserId: req.auth!.userId,
    approve: parsed.data.approve,
    reviewNote: parsed.data.reviewNote,
  });
  if (!reviewed) {
    res.status(404).json({ message: "Pending request not found" });
    return;
  }

  await sendPushToUsersSafe({
    userIds: [parsed.data.userId],
    title: parsed.data.approve ? "Club request approved" : "Club request rejected",
    body: parsed.data.approve
      ? "Your join request has been approved. You are now a club member."
      : "Your join request was rejected. You can try again later.",
    data: { type: "club_join_review", clubId: req.params.clubId, status: reviewed.status },
  });
  getIoServer()?.emit("club:join-reviewed", {
    clubId: req.params.clubId,
    userId: parsed.data.userId,
    status: reviewed.status,
  });

  res.json({
    clubId: reviewed.club_id,
    userId: reviewed.user_id,
    status: reviewed.status,
    reviewedAt: reviewed.reviewed_at,
  });
});

clubsRouter.delete("/:clubId/members/:userId", async (req, res) => {
  const allowed = await isClubAdminOrModerator(req.params.clubId, req.auth!.userId);
  if (!allowed) {
    res.status(403).json({ message: "Only club admin/moderator can remove members" });
    return;
  }

  const ok = await removeMember({
    clubId: req.params.clubId,
    userId: req.params.userId,
    actorUserId: req.auth!.userId,
  });
  if (!ok) {
    res.status(404).json({ message: "Approved member not found or cannot remove admin" });
    return;
  }
  await sendPushToUsersSafe({
    userIds: [req.params.userId],
    title: "Club membership updated",
    body: "You were removed from the club by an admin.",
    data: { type: "club_member_removed", clubId: req.params.clubId },
  });
  res.status(204).send();
});

clubsRouter.patch("/:clubId", async (req, res) => {
  const parsed = updateClubSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }
  const allowed = await isClubAdminOrModerator(req.params.clubId, req.auth!.userId);
  if (!allowed) {
    res.status(403).json({ message: "Only club admin/moderator can update profile" });
    return;
  }
  const updated = await updateClubProfile({ clubId: req.params.clubId, ...parsed.data });
  if (!updated) {
    res.status(404).json({ message: "Club not found" });
    return;
  }
  res.json({
    id: updated.id,
    clubCode: updated.club_code,
    clubName: updated.club_name,
    adminName: updated.admin_name,
    about: updated.about,
    city: updated.city,
    state: updated.state,
    country: updated.country,
    facebookUrl: updated.facebook_url,
    instagramUrl: updated.instagram_url,
    logoUrl: updated.logo_url,
  });
});

clubsRouter.get("/:clubId/membership", async (req, res) => {
  const membership = await getMembership(req.params.clubId, req.auth!.userId);
  res.json({
    status: membership?.status ?? null,
    role: membership?.role ?? null,
    requestedAt: membership?.requested_at ?? null,
    reviewedAt: membership?.reviewed_at ?? null,
  });
});

clubsRouter.get("/me/club", async (req, res) => {
  const club = await getClubByOwnerUserId(req.auth!.userId);
  if (!club) {
    res.status(404).json({ message: "No owned club found for this account" });
    return;
  }
  res.json({
    id: club.id,
    clubCode: club.club_code,
    clubName: club.club_name,
    clubUsername: club.club_username,
    adminName: club.admin_name,
    about: club.about,
    logoUrl: club.logo_url,
    city: club.city,
    state: club.state,
    country: club.country,
    facebookUrl: club.facebook_url,
    instagramUrl: club.instagram_url,
    identityVerificationStatus: club.identity_verification_status,
  });
});

clubsRouter.delete("/:clubId", async (req, res) => {
  const result = await deactivateClubAndReassignRiders(req.params.clubId, req.auth!.userId);
  if (!result.ok) {
    res.status(403).json({ message: "Only active club admin can archive this club" });
    return;
  }
  if (result.affectedRiderIds.length > 0) {
    await sendPushToUsersSafe({
      userIds: result.affectedRiderIds,
      title: "Club archived",
      body: "Your club was archived. Your profile has been switched to Solo Rider.",
      data: { type: "profile_system_change", reason: "club_archived", clubId: req.params.clubId },
    });
  }
  res.status(204).send();
});
