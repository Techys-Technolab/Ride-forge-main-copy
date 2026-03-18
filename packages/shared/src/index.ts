export type UserRole = "rider" | "club_admin" | "club_moderator" | "club_member" | "admin";
export type AccountType = "rider" | "club";
export type VerificationState = "pending" | "verified";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  phone?: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  accountType?: AccountType;
  riderId?: string;
  clubId?: string;
  clubRecordId?: string;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  onboardingStatus?: "pending_verification" | "active" | "suspended";
  language: string;
  city?: string;
  state?: string;
  country?: string;
  rewardPoints?: number;
}

export interface RidePoint {
  lat: number;
  lng: number;
  speed?: number;
  altitude?: number;
  ts: string;
}

export interface RideSummary {
  id: string;
  userId: string;
  distanceKm: number;
  durationSec: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  startedAt: string;
  endedAt?: string;
  points: RidePoint[];
}

export interface RouteWaypoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  hazard?: string;
}

export interface RouteDefinition {
  id: string;
  name: string;
  description?: string;
  creatorId: string;
  waypoints: RouteWaypoint[];
  tags: string[];
  isPublic: boolean;
}

export interface FeedPost {
  id: string;
  authorId: string;
  caption: string;
  imageUrl?: string;
  createdAt: string;
  rideId?: string;
  likes: number;
}

export interface GroupEvent {
  id: string;
  kind?: "ride" | "event";
  title: string;
  description?: string;
  hostId: string;
  startAt: string;
  locationName: string;
  lat: number;
  lng: number;
  attendeeIds: string[];
}

export interface SubscriptionState {
  userId: string;
  tier: "free" | "pro";
  active: boolean;
  renewalDate?: string;
}
