import { AuthUserRow } from "./repository";

export function mapAuthUserToProfile(user: AuthUserRow) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    phone: user.phone,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    role: user.role,
    accountType: user.account_type,
    riderId: user.rider_member_code,
    clubId: user.club_member_code,
    isEmailVerified: user.is_email_verified,
    isPhoneVerified: user.is_phone_verified,
    onboardingStatus: user.onboarding_status,
    language: user.language,
    city: user.city,
    state: user.state,
    country: user.country,
    rewardPoints: Number(user.reward_points ?? 0),
  };
}
