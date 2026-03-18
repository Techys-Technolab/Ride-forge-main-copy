import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { authGuard } from "../../middleware/auth";
import { mapAuthUserToProfile } from "./mappers";
import {
  consumePasswordResetCode,
  createClubUser,
  createOrUpdateVerificationCode,
  createOrUpdatePasswordResetCode,
  createRiderUser,
  findUserByEmail,
  findUserById,
  findPasswordResetCode,
  findUserByPhone,
  findUserByUsernameOrEmail,
  findVerificationCode,
  markChannelVerified,
  recordPasswordResetAttempt,
  recordVerificationAttempt,
  updateUserPassword,
  VerificationChannel,
} from "./repository";
import { hasRefreshSession, saveRefreshSession } from "./sessionStore";
import { signAccessToken, signRefreshToken, verifyToken } from "../../utils/token";
import { isClubNameTaken } from "../clubs/repository";
import { env } from "../../config/env";
import { deliverOtp } from "./otpDelivery";
import { sendPushToUsersSafe } from "../notifications/service";
import { upsertDeviceToken } from "../notifications/repository";

const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/;
const IMAGE_REGEX = /^(https?:\/\/|file:\/\/).+\.(jpg|jpeg|png)(\?.*)?$/i;

const urlSchema = z.string().url();

const riderSignUpSchema = z
  .object({
    accountType: z.literal("rider"),
    username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/),
    password: z.string().min(10).regex(PASSWORD_REGEX, "Password must include uppercase, lowercase, and number"),
    fullName: z.string().trim().min(2).max(80),
    email: z.string().trim().email(),
    phone: z.string().trim().regex(PHONE_REGEX, "Invalid phone number"),
    bloodGroup: z.string().trim().min(2).max(6),
    emergencyContactName: z.string().trim().min(2).max(80),
    emergencyContactNumber: z.string().trim().regex(PHONE_REGEX, "Invalid emergency phone number"),
    city: z.string().trim().min(2).max(80),
    state: z.string().trim().min(2).max(80),
    country: z.string().trim().min(2).max(80),
    bikeModels: z.array(z.string().trim().min(2).max(64)).min(1).max(8),
    clubName: z.string().trim().min(2).max(120).optional(),
    isSoloRider: z.boolean(),
    profilePictureUrl: z.string().trim().regex(IMAGE_REGEX).optional(),
    profilePictureMeta: z
      .object({
        mimeType: z.string(),
        sizeBytes: z.number().int().max(5 * 1024 * 1024),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.isSoloRider && !value.clubName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clubName"],
        message: "Club Name is required when solo rider is unchecked",
      });
    }
  });

const clubSignUpSchema = z.object({
  accountType: z.literal("club"),
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/),
  password: z.string().min(10).regex(PASSWORD_REGEX, "Password must include uppercase, lowercase, and number"),
  clubName: z.string().trim().min(2).max(120),
  adminName: z.string().trim().min(2).max(120),
  about: z.string().trim().min(10).max(1000),
  email: z.string().trim().email(),
  phone: z.string().trim().regex(PHONE_REGEX),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  country: z.string().trim().min(2).max(80),
  facebookUrl: urlSchema.optional(),
  instagramUrl: urlSchema.optional(),
  clubLogoUrl: z.string().trim().regex(IMAGE_REGEX).optional(),
  clubLogoMeta: z
    .object({
      mimeType: z.string(),
      sizeBytes: z.number().int().max(5 * 1024 * 1024),
    })
    .optional(),
});

const verifySchema = z.object({
  userId: z.string().uuid(),
  channel: z.enum(["email", "phone"]),
  code: z.string().length(6).regex(/^\d+$/),
});

const resendSchema = z.object({
  userId: z.string().uuid(),
  channel: z.enum(["email", "phone"]),
});

const loginSchema = z.object({
  login: z.string().min(3),
  password: z.string().min(10),
  deviceToken: z.string().min(20).optional(),
  devicePlatform: z.enum(["android", "ios", "web"]).optional(),
}).superRefine((value, ctx) => {
  const tokenProvided = Boolean(value.deviceToken);
  const platformProvided = Boolean(value.devicePlatform);
  if (tokenProvided !== platformProvided) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["deviceToken"],
      message: "deviceToken and devicePlatform must be provided together",
    });
  }
});

const oauthSchema = z.object({
  provider: z.enum(["google", "apple"]),
  providerToken: z.string().min(10),
  email: z.string().email(),
  displayName: z.string().min(2),
});

const forgotPasswordRequestSchema = z.object({
  login: z.string().min(3),
  channel: z.enum(["email", "phone"]).default("email"),
});

const forgotPasswordConfirmSchema = z.object({
  login: z.string().min(3),
  channel: z.enum(["email", "phone"]).default("email"),
  code: z.string().length(6).regex(/^\d+$/),
  newPassword: z.string().min(10).regex(PASSWORD_REGEX, "Password must include uppercase, lowercase, and number"),
});

const OTP_TTL_MINUTES = 10;
const RESEND_MIN_SECONDS = 45;

export const authRouter = Router();

authRouter.post("/signup/rider", async (req, res) => {
  const parsed = riderSignUpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const payload = parsed.data;
  const duplicate = await detectDuplicate({
    email: payload.email,
    username: payload.username,
    phone: payload.phone,
  });
  if (duplicate) {
    res.status(409).json({ message: duplicate });
    return;
  }

  const passwordHash = await bcrypt.hash(payload.password, 12);
  const user = await createRiderUser({
    email: payload.email,
    username: payload.username,
    phone: payload.phone,
    passwordHash,
    displayName: payload.fullName,
    avatarUrl: payload.profilePictureUrl,
    language: "en",
    city: normalizeLocation(payload.city),
    state: normalizeLocation(payload.state),
    country: normalizeLocation(payload.country),
    fullName: payload.fullName,
    bloodGroup: payload.bloodGroup.toUpperCase(),
    emergencyContactName: payload.emergencyContactName,
    emergencyContactPhone: payload.emergencyContactNumber,
    bikeModels: payload.bikeModels.map((m) => m.trim()),
    clubName: payload.clubName,
    isSoloRider: payload.isSoloRider,
  });

  let emailOtp: string | undefined;
  let phoneOtp: string | undefined;
  try {
    emailOtp = await issueVerificationCode(user.id, "email", user.email, "registration");
    phoneOtp = await issueVerificationCode(user.id, "phone", payload.phone, "registration");
  } catch (error) {
    res.status(502).json({ message: `Failed to deliver verification OTP: ${String(error)}` });
    return;
  }

  res.status(201).json({
    user: mapAuthUserToProfile(user),
    message: "Rider account created. Verify email and phone to activate access.",
    verification: {
      userId: user.id,
      email: { channel: "email", expiresInSec: OTP_TTL_MINUTES * 60, resendAfterSec: RESEND_MIN_SECONDS },
      phone: { channel: "phone", expiresInSec: OTP_TTL_MINUTES * 60, resendAfterSec: RESEND_MIN_SECONDS },
      devCodes: env.otpExposeDevCodes
        ? {
              emailOtp,
              phoneOtp,
          }
        : undefined,
    },
  });

  await sendPushToUsersSafe({
    userIds: [user.id],
    title: "Profile created",
    body: "Your Rider profile is created. Verify email and phone to activate access.",
    data: { type: "profile_created", accountType: "rider", userId: user.id },
  });
});

authRouter.post("/signup/club", async (req, res) => {
  const parsed = clubSignUpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const payload = parsed.data;
  const duplicate = await detectDuplicate({
    email: payload.email,
    username: payload.username,
    phone: payload.phone,
    clubName: payload.clubName,
  });
  if (duplicate) {
    res.status(409).json({ message: duplicate });
    return;
  }

  const passwordHash = await bcrypt.hash(payload.password, 12);
  const user = await createClubUser({
    email: payload.email,
    username: payload.username,
    phone: payload.phone,
    passwordHash,
    displayName: payload.clubName,
    avatarUrl: payload.clubLogoUrl,
    language: "en",
    city: normalizeLocation(payload.city),
    state: normalizeLocation(payload.state),
    country: normalizeLocation(payload.country),
    clubName: payload.clubName,
    adminName: payload.adminName,
    about: payload.about,
    facebookUrl: payload.facebookUrl,
    instagramUrl: payload.instagramUrl,
  });

  let emailOtp: string | undefined;
  let phoneOtp: string | undefined;
  try {
    emailOtp = await issueVerificationCode(user.id, "email", user.email, "registration");
    phoneOtp = await issueVerificationCode(user.id, "phone", payload.phone, "registration");
  } catch (error) {
    res.status(502).json({ message: `Failed to deliver verification OTP: ${String(error)}` });
    return;
  }

  res.status(201).json({
    user: mapAuthUserToProfile(user),
    message: "Club account created. Verify email and phone to activate club tools.",
    verification: {
      userId: user.id,
      email: { channel: "email", expiresInSec: OTP_TTL_MINUTES * 60, resendAfterSec: RESEND_MIN_SECONDS },
      phone: { channel: "phone", expiresInSec: OTP_TTL_MINUTES * 60, resendAfterSec: RESEND_MIN_SECONDS },
      identityVerification: "pending",
      devCodes: env.otpExposeDevCodes
        ? {
              emailOtp,
              phoneOtp,
          }
        : undefined,
    },
  });

  await sendPushToUsersSafe({
    userIds: [user.id],
    title: "Profile created",
    body: "Your Club profile is created. Verify email and phone to activate club tools.",
    data: { type: "profile_created", accountType: "club", userId: user.id },
  });
});

authRouter.post("/verify", async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const record = await findVerificationCode(parsed.data.userId, parsed.data.channel);
  if (!record) {
    res.status(404).json({ message: "Verification challenge not found" });
    return;
  }
  if (record.verified_at) {
    res.json({ message: `${parsed.data.channel} already verified` });
    return;
  }

  const now = Date.now();
  const expiresAt = new Date(record.expires_at).getTime();
  if (expiresAt <= now) {
    res.status(410).json({ message: "OTP expired. Request a new code." });
    return;
  }
  if (record.attempts >= record.max_attempts) {
    res.status(429).json({ message: "Maximum attempts reached. Please resend OTP." });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.code, record.code_hash);
  if (!valid) {
    await recordVerificationAttempt(record.id);
    res.status(401).json({ message: "Incorrect OTP code" });
    return;
  }

  await markChannelVerified({ userId: parsed.data.userId, channel: parsed.data.channel });
  const user = await findUserById(parsed.data.userId);
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  res.json({
    message: `${parsed.data.channel} verified successfully`,
    user: mapAuthUserToProfile(user),
    verification: {
      isEmailVerified: user.is_email_verified,
      isPhoneVerified: user.is_phone_verified,
      isFullyVerified: user.is_email_verified && user.is_phone_verified,
    },
  });

  if (user.is_email_verified && user.is_phone_verified) {
    await sendPushToUsersSafe({
      userIds: [user.id],
      title: "Account verified",
      body: "Your Rideforge account is fully verified and active.",
      data: { type: "auth_account_verified", userId: user.id },
    });
  }
});

authRouter.post("/verify/resend", async (req, res) => {
  const parsed = resendSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }
  const user = await findUserById(parsed.data.userId);
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  const record = await findVerificationCode(parsed.data.userId, parsed.data.channel);
  if (record && new Date(record.last_sent_at).getTime() + RESEND_MIN_SECONDS * 1000 > Date.now()) {
    res.status(429).json({ message: `Please wait ${RESEND_MIN_SECONDS} seconds before requesting again` });
    return;
  }

  const target = parsed.data.channel === "email" ? user.email : user.phone;
  if (!target) {
    res.status(400).json({ message: `No ${parsed.data.channel} target found` });
    return;
  }

  let otp: string | undefined;
  try {
    otp = await issueVerificationCode(user.id, parsed.data.channel, target, "resend");
  } catch (error) {
    res.status(502).json({ message: `Failed to resend OTP: ${String(error)}` });
    return;
  }
  res.json({
    message: `${parsed.data.channel} OTP sent`,
    expiresInSec: OTP_TTL_MINUTES * 60,
    resendAfterSec: RESEND_MIN_SECONDS,
    devCode: env.otpExposeDevCodes ? otp : undefined,
  });
});

authRouter.post("/forgot-password/request", async (req, res) => {
  const parsed = forgotPasswordRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const user = await findUserByUsernameOrEmail(parsed.data.login);
  if (!user) {
    res.json({ message: "If the account exists, a reset code has been sent." });
    return;
  }

  const existing = await findPasswordResetCode(user.id, parsed.data.channel);
  if (existing && new Date(existing.last_sent_at).getTime() + RESEND_MIN_SECONDS * 1000 > Date.now()) {
    res.status(429).json({ message: `Please wait ${RESEND_MIN_SECONDS} seconds before requesting again` });
    return;
  }

  const target = parsed.data.channel === "email" ? user.email : user.phone;
  if (!target) {
    res.status(400).json({ message: `No ${parsed.data.channel} target found for this account` });
    return;
  }

  let otp: string | undefined;
  try {
    otp = await issuePasswordResetCode(user.id, parsed.data.channel, target);
  } catch (error) {
    res.status(502).json({ message: `Failed to send reset code: ${String(error)}` });
    return;
  }

  res.json({
    message: "If the account exists, a reset code has been sent.",
    expiresInSec: OTP_TTL_MINUTES * 60,
    resendAfterSec: RESEND_MIN_SECONDS,
    devCode: env.otpExposeDevCodes ? otp : undefined,
  });
});

authRouter.post("/forgot-password/confirm", async (req, res) => {
  const parsed = forgotPasswordConfirmSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const user = await findUserByUsernameOrEmail(parsed.data.login);
  if (!user) {
    res.status(400).json({ message: "Invalid reset code or account" });
    return;
  }

  const record = await findPasswordResetCode(user.id, parsed.data.channel);
  if (!record) {
    res.status(404).json({ message: "Reset challenge not found. Request a new code." });
    return;
  }
  if (record.consumed_at) {
    res.status(409).json({ message: "Reset code already used. Request a new one." });
    return;
  }
  if (new Date(record.expires_at).getTime() <= Date.now()) {
    res.status(410).json({ message: "Reset code expired. Request a new one." });
    return;
  }
  if (record.attempts >= record.max_attempts) {
    res.status(429).json({ message: "Maximum attempts reached. Request a new reset code." });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.code, record.code_hash);
  if (!valid) {
    await recordPasswordResetAttempt(record.id);
    res.status(401).json({ message: "Incorrect reset code" });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await updateUserPassword({ userId: user.id, passwordHash });
  await consumePasswordResetCode(record.id);
  await sendPushToUsersSafe({
    userIds: [user.id],
    title: "Password changed",
    body: "Your Rideforge password was updated. If this was not you, reset again and contact support.",
    data: { type: "auth_password_changed", userId: user.id },
  });
  res.json({ message: "Password updated successfully. You can now log in with your new password." });
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const user = await findUserByUsernameOrEmail(parsed.data.login);
  if (!user) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.password, user.password_hash);
  if (!valid) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  if (!user.is_email_verified || !user.is_phone_verified) {
    res.status(403).json({
      message: "Account verification required",
      verificationRequired: true,
      user: mapAuthUserToProfile(user),
    });
    return;
  }

  const accessToken = signAccessToken(user.id, user.email);
  const refreshToken = signRefreshToken(user.id, user.email);
  await saveRefreshSession(refreshToken, user.id);

  if (parsed.data.deviceToken && parsed.data.devicePlatform) {
    await upsertDeviceToken({
      userId: user.id,
      token: parsed.data.deviceToken,
      platform: parsed.data.devicePlatform,
    });
  }

  await sendPushToUsersSafe({
    userIds: [user.id],
    title: "Login successful",
    body: "Your account signed in successfully. If this was not you, reset password immediately.",
    data: { type: "auth_login_success", userId: user.id },
  });

  res.json({ user: mapAuthUserToProfile(user), tokens: { accessToken, refreshToken } });
});

authRouter.post("/oauth", async (req, res) => {
  const parsed = oauthSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  let user = await findUserByEmail(parsed.data.email);
  if (!user) {
    const passwordHash = await bcrypt.hash(`oauth:${parsed.data.providerToken}`, 12);
    user = await createRiderUser({
      email: parsed.data.email,
      username: parsed.data.email.split("@")[0],
      phone: `+1000000${Math.floor(Math.random() * 1000000).toString().padStart(6, "0")}`,
      passwordHash,
      displayName: parsed.data.displayName,
      language: "en",
      city: "Unknown",
      state: "Unknown",
      country: "Unknown",
      fullName: parsed.data.displayName,
      bloodGroup: "NA",
      emergencyContactName: parsed.data.displayName,
      emergencyContactPhone: "+10000000000",
      bikeModels: ["Unspecified"],
      isSoloRider: true,
    });
    await markChannelVerified({ userId: user.id, channel: "email" });
    await markChannelVerified({ userId: user.id, channel: "phone" });
    user = await findUserById(user.id);
  }

  if (!user) {
    res.status(500).json({ message: "Unable to create OAuth user" });
    return;
  }

  const accessToken = signAccessToken(user.id, user.email);
  const refreshToken = signRefreshToken(user.id, user.email);
  await saveRefreshSession(refreshToken, user.id);
  res.json({ user: mapAuthUserToProfile(user), tokens: { accessToken, refreshToken } });
});

authRouter.post("/refresh", async (req, res) => {
  const refreshToken = req.body?.refreshToken as string | undefined;
  if (!refreshToken) {
    res.status(400).json({ message: "refreshToken is required" });
    return;
  }

  const validSession = await hasRefreshSession(refreshToken);
  if (!validSession) {
    res.status(401).json({ message: "Session not found" });
    return;
  }

  try {
    const payload = verifyToken(refreshToken);
    const accessToken = signAccessToken(payload.sub, payload.email);
    res.json({ accessToken });
  } catch {
    res.status(401).json({ message: "Invalid refresh token" });
  }
});

authRouter.get("/me", authGuard, async (req, res) => {
  const user = await findUserById(req.auth!.userId);
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  res.json(mapAuthUserToProfile(user));
});

async function detectDuplicate(input: {
  email: string;
  username: string;
  phone: string;
  clubName?: string;
}): Promise<string | null> {
  const [emailUser, usernameOrEmailUser, phoneUser] = await Promise.all([
    findUserByEmail(input.email.toLowerCase()),
    findUserByUsernameOrEmail(input.username.toLowerCase()),
    findUserByPhone(input.phone),
  ]);
  if (emailUser) return "Email already registered";
  if (usernameOrEmailUser && usernameOrEmailUser.username?.toLowerCase() === input.username.toLowerCase()) {
    return "Username already registered";
  }
  if (phoneUser) return "Phone number already registered";
  if (input.clubName) {
    const clubTaken = await isClubNameTaken(input.clubName);
    if (clubTaken) {
      return "Club name already exists";
    }
  }
  return null;
}

async function issueVerificationCode(
  userId: string,
  channel: VerificationChannel,
  target: string,
  purpose: "registration" | "resend",
): Promise<string> {
  const otp = `${crypto.randomInt(0, 1000000)}`.padStart(6, "0");
  const codeHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
  await createOrUpdateVerificationCode({ userId, channel, target, codeHash, expiresAt });
  await deliverOtp({ channel, target, code: otp, purpose });
  return otp;
}

async function issuePasswordResetCode(userId: string, channel: VerificationChannel, target: string): Promise<string> {
  const otp = `${crypto.randomInt(0, 1000000)}`.padStart(6, "0");
  const codeHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
  await createOrUpdatePasswordResetCode({ userId, channel, target, codeHash, expiresAt });
  await deliverOtp({ channel, target, code: otp, purpose: "password_reset" });
  return otp;
}

function normalizeLocation(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
