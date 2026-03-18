import { Router } from "express";
import { z } from "zod";
import { authGuard } from "../../middleware/auth";
import { sendPushToUsersSafe } from "../notifications/service";
import {
  getClubProfileDetails,
  getProfileSummary,
  getRiderProfileDetails,
  updateClubProfileByOwner,
  updateRiderProfile,
} from "./repository";

const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;
const IMAGE_URL_REGEX = /^(https?:\/\/|file:\/\/).+\.(jpg|jpeg|png)(\?.*)?$/i;

const riderUpdateSchema = z
  .object({
    displayName: z.string().trim().min(2).max(80),
    phone: z.string().trim().regex(PHONE_REGEX),
    city: z.string().trim().min(2).max(80),
    state: z.string().trim().min(2).max(80),
    country: z.string().trim().min(2).max(80),
    avatarUrl: z.string().trim().regex(IMAGE_URL_REGEX).optional(),
    fullName: z.string().trim().min(2).max(80),
    bloodGroup: z.string().trim().min(2).max(6),
    emergencyContactName: z.string().trim().min(2).max(80),
    emergencyContactPhone: z.string().trim().regex(PHONE_REGEX),
    bikeModels: z.array(z.string().trim().min(2).max(64)).min(1).max(8),
    clubName: z.string().trim().min(2).max(120).optional(),
    isSoloRider: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (!value.isSoloRider && !value.clubName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["clubName"], message: "Club name is required" });
    }
  });

const clubUpdateSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(PHONE_REGEX),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  country: z.string().trim().min(2).max(80),
  logoUrl: z.string().trim().regex(IMAGE_URL_REGEX).optional(),
  clubName: z.string().trim().min(2).max(120),
  adminName: z.string().trim().min(2).max(120),
  about: z.string().trim().min(10).max(1000),
  facebookUrl: z.string().url().optional(),
  instagramUrl: z.string().url().optional(),
});

export const profileRouter = Router();
profileRouter.use(authGuard);

profileRouter.get("/me/summary", async (req, res) => {
  const summary = await getProfileSummary(req.auth!.userId);
  if (!summary) {
    res.status(404).json({ message: "Profile not found" });
    return;
  }
  res.json({
    id: summary.id,
    accountType: summary.account_type,
    role: summary.role,
    displayName: summary.display_name,
    email: summary.email,
    phone: summary.phone,
    riderId: summary.rider_member_code,
    clubId: summary.club_member_code,
    avatarUrl: summary.avatar_url,
    city: summary.city,
    state: summary.state,
    country: summary.country,
    rewardPoints: Number(summary.reward_points ?? 0),
    totalDistanceKm: Number(summary.ride_distance_total_km ?? 0),
    isEmailVerified: summary.is_email_verified,
    isPhoneVerified: summary.is_phone_verified,
    onboardingStatus: summary.onboarding_status,
  });
});

profileRouter.get("/me/details", async (req, res) => {
  const summary = await getProfileSummary(req.auth!.userId);
  if (!summary) {
    res.status(404).json({ message: "Profile not found" });
    return;
  }

  if (summary.account_type === "rider") {
    const rider = await getRiderProfileDetails(req.auth!.userId);
    if (!rider) {
      res.status(404).json({ message: "Rider profile details not found" });
      return;
    }
    res.json({
      accountType: "rider",
      id: rider.id,
      riderId: rider.rider_member_code,
      displayName: rider.display_name,
      fullName: rider.full_name,
      email: rider.email,
      phone: rider.phone,
      bloodGroup: rider.blood_group,
      emergencyContactName: rider.emergency_contact_name,
      emergencyContactPhone: rider.emergency_contact_phone,
      city: rider.city,
      state: rider.state,
      country: rider.country,
      bikeModels: rider.bike_models,
      clubName: rider.club_name,
      isSoloRider: rider.is_solo_rider,
      avatarUrl: rider.avatar_url,
      rewardPoints: Number(rider.reward_points ?? 0),
      totalDistanceKm: Number(rider.ride_distance_total_km ?? 0),
      isEmailVerified: rider.is_email_verified,
      isPhoneVerified: rider.is_phone_verified,
      onboardingStatus: rider.onboarding_status,
    });
    return;
  }

  const club = await getClubProfileDetails(req.auth!.userId);
  if (!club) {
    res.status(404).json({ message: "Club profile details not found" });
    return;
  }
  res.json({
    accountType: "club",
    id: club.id,
    clubRecordId: club.club_id,
    clubId: club.club_member_code,
    displayName: club.display_name,
    email: club.email,
    phone: club.phone,
    city: club.city,
    state: club.state,
    country: club.country,
    logoUrl: club.logo_url,
    clubName: club.club_name,
    clubUsername: club.club_username,
    adminName: club.admin_name,
    about: club.about,
    facebookUrl: club.facebook_url,
    instagramUrl: club.instagram_url,
    memberCount: Number(club.member_count ?? 0),
    identityVerificationStatus: club.identity_verification_status,
    isEmailVerified: club.is_email_verified,
    isPhoneVerified: club.is_phone_verified,
    onboardingStatus: club.onboarding_status,
  });
});

profileRouter.patch("/me/rider", async (req, res) => {
  const summary = await getProfileSummary(req.auth!.userId);
  if (!summary || summary.account_type !== "rider") {
    res.status(403).json({ message: "Only rider accounts can update rider profile" });
    return;
  }
  const parsed = riderUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  try {
    const rider = await updateRiderProfile({ userId: req.auth!.userId, ...parsed.data });
    await sendPushToUsersSafe({
      userIds: [req.auth!.userId],
      title: "Profile updated",
      body: "Your rider profile was updated successfully.",
      data: { type: "profile_updated", accountType: "rider", userId: req.auth!.userId },
    });
    res.json({
      accountType: "rider",
      id: rider.id,
      riderId: rider.rider_member_code,
      displayName: rider.display_name,
      fullName: rider.full_name,
      email: rider.email,
      phone: rider.phone,
      bloodGroup: rider.blood_group,
      emergencyContactName: rider.emergency_contact_name,
      emergencyContactPhone: rider.emergency_contact_phone,
      city: rider.city,
      state: rider.state,
      country: rider.country,
      bikeModels: rider.bike_models,
      clubName: rider.club_name,
      isSoloRider: rider.is_solo_rider,
      avatarUrl: rider.avatar_url,
      rewardPoints: Number(rider.reward_points ?? 0),
      totalDistanceKm: Number(rider.ride_distance_total_km ?? 0),
      isEmailVerified: rider.is_email_verified,
      isPhoneVerified: rider.is_phone_verified,
      onboardingStatus: rider.onboarding_status,
    });
  } catch (error: any) {
    await sendPushToUsersSafe({
      userIds: [req.auth!.userId],
      title: "Profile update failed",
      body: "We could not update your rider profile. Please try again.",
      data: { type: "profile_update_failed", accountType: "rider", userId: req.auth!.userId },
    });
    if (error?.code === "23505") {
      res.status(409).json({ message: "Phone number or club data conflicts with an existing record" });
      return;
    }
    res.status(500).json({ message: "Failed to update rider profile" });
  }
});

profileRouter.patch("/me/club", async (req, res) => {
  const summary = await getProfileSummary(req.auth!.userId);
  if (!summary || summary.account_type !== "club") {
    res.status(403).json({ message: "Only club accounts can update club profile" });
    return;
  }
  const parsed = clubUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  try {
    const club = await updateClubProfileByOwner({ userId: req.auth!.userId, ...parsed.data });
    await sendPushToUsersSafe({
      userIds: [req.auth!.userId],
      title: "Profile updated",
      body: "Your club profile was updated successfully.",
      data: { type: "profile_updated", accountType: "club", userId: req.auth!.userId },
    });
    res.json({
      accountType: "club",
      id: club.id,
      clubRecordId: club.club_id,
      clubId: club.club_member_code,
      displayName: club.display_name,
      email: club.email,
      phone: club.phone,
      city: club.city,
      state: club.state,
      country: club.country,
      logoUrl: club.logo_url,
      clubName: club.club_name,
      clubUsername: club.club_username,
      adminName: club.admin_name,
      about: club.about,
      facebookUrl: club.facebook_url,
      instagramUrl: club.instagram_url,
      memberCount: Number(club.member_count ?? 0),
      identityVerificationStatus: club.identity_verification_status,
      isEmailVerified: club.is_email_verified,
      isPhoneVerified: club.is_phone_verified,
      onboardingStatus: club.onboarding_status,
    });
  } catch (error: any) {
    await sendPushToUsersSafe({
      userIds: [req.auth!.userId],
      title: "Profile update failed",
      body: "We could not update your club profile. Please try again.",
      data: { type: "profile_update_failed", accountType: "club", userId: req.auth!.userId },
    });
    if (error?.code === "23505") {
      res.status(409).json({ message: "Phone number or club identity conflicts with an existing record" });
      return;
    }
    res.status(500).json({ message: "Failed to update club profile" });
  }
});
