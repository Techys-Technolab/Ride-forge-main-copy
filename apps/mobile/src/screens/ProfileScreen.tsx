import React, { useEffect, useMemo, useState } from "react";
import { Alert, ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { SurfaceCard } from "../components/SurfaceCard";
import { ScreenTitle } from "../components/ScreenTitle";
import { api } from "../services/api";
import { useAuthStore } from "../state/authStore";
import { theme } from "../theme/theme";

type SummaryPayload = {
  id: string;
  accountType: "rider" | "club";
  role: string;
  displayName: string;
  email: string;
  phone?: string;
  riderId?: string;
  clubId?: string;
  avatarUrl?: string;
  city?: string;
  state?: string;
  country?: string;
  rewardPoints: number;
  totalDistanceKm: number;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  onboardingStatus: string;
};

type RiderDetail = {
  accountType: "rider";
  id: string;
  riderId?: string;
  displayName: string;
  fullName: string;
  email: string;
  phone?: string;
  bloodGroup: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  city?: string;
  state?: string;
  country?: string;
  bikeModels: string[];
  clubName?: string;
  isSoloRider: boolean;
  avatarUrl?: string;
  rewardPoints: number;
  totalDistanceKm: number;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
};

type ClubDetail = {
  accountType: "club";
  id: string;
  clubRecordId: string;
  clubId?: string;
  displayName: string;
  email: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
  logoUrl?: string;
  clubName: string;
  clubUsername: string;
  adminName: string;
  about: string;
  facebookUrl?: string;
  instagramUrl?: string;
  memberCount: number;
  identityVerificationStatus: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
};

type DetailPayload = RiderDetail | ClubDetail;

type ValidationErrors = Record<string, string>;

const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;

export const ProfileScreen = () => {
  const clearSession = useAuthStore((s) => s.clearSession);
  const setUser = useAuthStore((s) => s.setUser);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"summary" | "details">("summary");
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [details, setDetails] = useState<DetailPayload | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [bikeModelInput, setBikeModelInput] = useState("");
  const [editMode, setEditMode] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [summaryData, detailData] = await Promise.all([
        api.get<SummaryPayload>("/api/profile/me/summary"),
        api.get<DetailPayload>("/api/profile/me/details"),
      ]);
      setSummary(summaryData);
      setDetails(detailData);
      setDraft(detailData as any);
      setErrors({});
    } catch (error) {
      Alert.alert("Profile", String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(details ?? {}), [draft, details]);

  const resetDraft = () => {
    setDraft(details as any);
    setErrors({});
    setBikeModelInput("");
  };

  const validateRider = (rider: RiderDetail): boolean => {
    const next: ValidationErrors = {};
    if (!rider.displayName?.trim()) next.displayName = "Display name is required";
    if (!rider.fullName?.trim()) next.fullName = "Full name is required";
    if (!rider.phone || !PHONE_REGEX.test(rider.phone)) next.phone = "Valid phone is required";
    if (!rider.bloodGroup?.trim()) next.bloodGroup = "Blood group is required";
    if (!rider.emergencyContactName?.trim()) next.emergencyContactName = "Emergency contact name is required";
    if (!rider.emergencyContactPhone || !PHONE_REGEX.test(rider.emergencyContactPhone)) {
      next.emergencyContactPhone = "Valid emergency phone is required";
    }
    if (!rider.city?.trim()) next.city = "City is required";
    if (!rider.state?.trim()) next.state = "State is required";
    if (!rider.country?.trim()) next.country = "Country is required";
    if (!Array.isArray(rider.bikeModels) || rider.bikeModels.length === 0) next.bikeModels = "At least one bike model is required";
    if (!rider.isSoloRider && !rider.clubName?.trim()) next.clubName = "Club name is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateClub = (club: ClubDetail): boolean => {
    const next: ValidationErrors = {};
    if (!club.displayName?.trim()) next.displayName = "Display name is required";
    if (!club.phone || !PHONE_REGEX.test(club.phone)) next.phone = "Valid phone is required";
    if (!club.city?.trim()) next.city = "City is required";
    if (!club.state?.trim()) next.state = "State is required";
    if (!club.country?.trim()) next.country = "Country is required";
    if (!club.clubName?.trim()) next.clubName = "Club name is required";
    if (!club.adminName?.trim()) next.adminName = "Admin name is required";
    if (!club.about?.trim() || club.about.trim().length < 10) next.about = "About club must be at least 10 characters";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const saveProfile = async () => {
    if (!details) return;
    const payload = draft as DetailPayload;
    const valid = payload.accountType === "rider" ? validateRider(payload) : validateClub(payload as ClubDetail);
    if (!valid) return;

    setSaving(true);
    try {
      const updated =
        payload.accountType === "rider"
          ? await api.patch<RiderDetail>("/api/profile/me/rider", {
              displayName: payload.displayName,
              phone: payload.phone,
              city: payload.city,
              state: payload.state,
              country: payload.country,
              avatarUrl: (payload as RiderDetail).avatarUrl?.trim() || undefined,
              fullName: (payload as RiderDetail).fullName,
              bloodGroup: (payload as RiderDetail).bloodGroup,
              emergencyContactName: (payload as RiderDetail).emergencyContactName,
              emergencyContactPhone: (payload as RiderDetail).emergencyContactPhone,
              bikeModels: (payload as RiderDetail).bikeModels,
              clubName: (payload as RiderDetail).clubName,
              isSoloRider: (payload as RiderDetail).isSoloRider,
            })
          : await api.patch<ClubDetail>("/api/profile/me/club", {
              displayName: payload.displayName,
              phone: payload.phone,
              city: payload.city,
              state: payload.state,
              country: payload.country,
              logoUrl: (payload as ClubDetail).logoUrl?.trim() || undefined,
              clubName: (payload as ClubDetail).clubName,
              adminName: (payload as ClubDetail).adminName,
              about: (payload as ClubDetail).about,
              facebookUrl: (payload as ClubDetail).facebookUrl?.trim() || undefined,
              instagramUrl: (payload as ClubDetail).instagramUrl?.trim() || undefined,
            });

      setDetails(updated);
      setDraft(updated as any);
      setSummary((prev) =>
        prev
          ? {
              ...prev,
              displayName: updated.displayName,
              phone: updated.phone,
              city: updated.city,
              state: updated.state,
              country: updated.country,
            }
          : prev,
      );
      setUser({
        id: updated.id,
        email: updated.email,
        displayName: updated.displayName,
        avatarUrl: (updated as any).avatarUrl ?? (updated as any).logoUrl,
        phone: updated.phone,
        role: summary?.role as any,
        accountType: updated.accountType,
        riderId: (updated as RiderDetail).riderId,
        clubId: (updated as any).clubId,
        isEmailVerified: (updated as any).isEmailVerified,
        isPhoneVerified: (updated as any).isPhoneVerified,
        language: "en",
        city: updated.city,
        state: updated.state,
        country: updated.country,
        rewardPoints: (updated as any).rewardPoints,
      });
      setEditMode(false);
      Alert.alert("Profile", "Profile updated successfully.");
    } catch (error) {
      Alert.alert("Profile update failed", String(error));
    } finally {
      setSaving(false);
    }
  };

  const toggleEditMode = () => {
    if (editMode && isDirty) {
      Alert.alert("Discard changes?", "You have unsaved changes. Discard them?", [
        { text: "Keep Editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            resetDraft();
            setEditMode(false);
          },
        },
      ]);
      return;
    }
    if (!editMode) {
      resetDraft();
    }
    setEditMode((prev) => !prev);
  };

  const addBike = () => {
    const bike = bikeModelInput.trim();
    if (!bike) return;
    const current = Array.isArray((draft as RiderDetail).bikeModels) ? (draft as RiderDetail).bikeModels : [];
    if (current.some((item) => item.toLowerCase() === bike.toLowerCase())) return;
    setDraft({ ...draft, bikeModels: [...current, bike] });
    setBikeModelInput("");
  };

  const removeBike = (bike: string) => {
    const current = Array.isArray((draft as RiderDetail).bikeModels) ? (draft as RiderDetail).bikeModels : [];
    setDraft({ ...draft, bikeModels: current.filter((item) => item !== bike) });
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.brand.primary} />
          <Text style={styles.help}>Loading profile...</Text>
        </View>
      </Screen>
    );
  }

  if (!summary || !details) {
    return (
      <Screen>
        <ScreenTitle title="Profile" subtitle="No profile data available." />
        <AppButton label="Retry" onPress={load} />
        <AppButton label="Sign Out" variant="secondary" onPress={clearSession} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenTitle title="Profile" subtitle={summary.accountType === "rider" ? "Rider Account" : "Riding Club Account"} />
      <View style={styles.tabRow}>
        <Pressable style={[styles.tab, tab === "summary" && styles.tabActive]} onPress={() => setTab("summary")}>
          <Text style={styles.tabText}>Summary</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === "details" && styles.tabActive]} onPress={() => setTab("details")}>
          <Text style={styles.tabText}>Detailed</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {tab === "summary" ? (
          <>
            <SurfaceCard>
              <Text style={styles.title}>{summary.displayName}</Text>
              <Text style={styles.meta}>{summary.email}</Text>
              <Text style={styles.meta}>{summary.phone ?? "No phone"}</Text>
              <Text style={styles.meta}>
                {summary.city}, {summary.state}, {summary.country}
              </Text>
              {summary.riderId ? <Text style={styles.meta}>Ride Forge Rider ID: {summary.riderId}</Text> : null}
              {summary.clubId ? <Text style={styles.meta}>Ride Forge Club ID: {summary.clubId}</Text> : null}
              <Text style={styles.meta}>
                Verification: {summary.isEmailVerified ? "Email Verified" : "Email Pending"} /{" "}
                {summary.isPhoneVerified ? "Phone Verified" : "Phone Pending"}
              </Text>
              <Text style={styles.meta}>Onboarding: {summary.onboardingStatus}</Text>
            </SurfaceCard>

            <SurfaceCard>
              <Text style={styles.sectionTitle}>Activity</Text>
              <Text style={styles.meta}>Reward Points: {summary.rewardPoints}</Text>
              <Text style={styles.meta}>Total Distance: {summary.totalDistanceKm.toFixed(1)} km</Text>
            </SurfaceCard>
          </>
        ) : (
          <SurfaceCard>
            <View style={styles.actionRow}>
              <Text style={styles.sectionTitle}>Detailed Profile</Text>
              <AppButton label={editMode ? "Cancel Edit" : "Edit Profile"} variant="secondary" onPress={toggleEditMode} />
            </View>

            {details.accountType === "rider" ? (
              <>
                <AppInput editable={editMode} value={(draft as RiderDetail).displayName} onChangeText={(v) => setDraft({ ...draft, displayName: v })} placeholder="Display Name" />
                {errors.displayName ? <Text style={styles.error}>{errors.displayName}</Text> : null}
                <AppInput editable={editMode} value={(draft as RiderDetail).fullName} onChangeText={(v) => setDraft({ ...draft, fullName: v })} placeholder="Full Name" />
                {errors.fullName ? <Text style={styles.error}>{errors.fullName}</Text> : null}
                <AppInput editable={false} value={(draft as RiderDetail).email} placeholder="Email (read-only)" />
                <AppInput editable={editMode} value={(draft as RiderDetail).phone ?? ""} onChangeText={(v) => setDraft({ ...draft, phone: v })} placeholder="Phone Number" />
                {errors.phone ? <Text style={styles.error}>{errors.phone}</Text> : null}
                <AppInput editable={editMode} value={(draft as RiderDetail).bloodGroup} onChangeText={(v) => setDraft({ ...draft, bloodGroup: v })} placeholder="Blood Group" />
                {errors.bloodGroup ? <Text style={styles.error}>{errors.bloodGroup}</Text> : null}
                <AppInput
                  editable={editMode}
                  value={(draft as RiderDetail).emergencyContactName}
                  onChangeText={(v) => setDraft({ ...draft, emergencyContactName: v })}
                  placeholder="Emergency Contact Name"
                />
                {errors.emergencyContactName ? <Text style={styles.error}>{errors.emergencyContactName}</Text> : null}
                <AppInput
                  editable={editMode}
                  value={(draft as RiderDetail).emergencyContactPhone}
                  onChangeText={(v) => setDraft({ ...draft, emergencyContactPhone: v })}
                  placeholder="Emergency Contact Number"
                />
                {errors.emergencyContactPhone ? <Text style={styles.error}>{errors.emergencyContactPhone}</Text> : null}
                <AppInput editable={editMode} value={(draft as RiderDetail).city ?? ""} onChangeText={(v) => setDraft({ ...draft, city: v })} placeholder="City" />
                {errors.city ? <Text style={styles.error}>{errors.city}</Text> : null}
                <AppInput editable={editMode} value={(draft as RiderDetail).state ?? ""} onChangeText={(v) => setDraft({ ...draft, state: v })} placeholder="State" />
                {errors.state ? <Text style={styles.error}>{errors.state}</Text> : null}
                <AppInput editable={editMode} value={(draft as RiderDetail).country ?? ""} onChangeText={(v) => setDraft({ ...draft, country: v })} placeholder="Country" />
                {errors.country ? <Text style={styles.error}>{errors.country}</Text> : null}

                <Text style={styles.label}>Bike Models</Text>
                <View style={styles.bikeRow}>
                  <AppInput
                    style={styles.bikeInput}
                    editable={editMode}
                    value={bikeModelInput}
                    onChangeText={setBikeModelInput}
                    placeholder="Add bike model"
                  />
                  {editMode ? <AppButton label="Add" onPress={addBike} /> : null}
                </View>
                {errors.bikeModels ? <Text style={styles.error}>{errors.bikeModels}</Text> : null}
                <View style={styles.tags}>
                  {((draft as RiderDetail).bikeModels ?? []).map((model) => (
                    <Pressable key={model} disabled={!editMode} style={styles.tag} onPress={() => removeBike(model)}>
                      <Text style={styles.tagText}>{editMode ? `${model} x` : model}</Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.checkRow}>
                  <Switch
                    disabled={!editMode}
                    value={(draft as RiderDetail).isSoloRider}
                    onValueChange={(value) => setDraft({ ...draft, isSoloRider: value, clubName: value ? "" : (draft as RiderDetail).clubName })}
                  />
                  <Text style={styles.checkText}>Solo Rider</Text>
                </View>
                {!(draft as RiderDetail).isSoloRider ? (
                  <>
                    <AppInput editable={editMode} value={(draft as RiderDetail).clubName ?? ""} onChangeText={(v) => setDraft({ ...draft, clubName: v })} placeholder="Club Name" />
                    {errors.clubName ? <Text style={styles.error}>{errors.clubName}</Text> : null}
                  </>
                ) : null}
              </>
            ) : (
              <>
                <AppInput editable={editMode} value={(draft as ClubDetail).displayName} onChangeText={(v) => setDraft({ ...draft, displayName: v })} placeholder="Display Name" />
                {errors.displayName ? <Text style={styles.error}>{errors.displayName}</Text> : null}
                <AppInput editable={false} value={(draft as ClubDetail).email} placeholder="Email (read-only)" />
                <AppInput editable={editMode} value={(draft as ClubDetail).phone ?? ""} onChangeText={(v) => setDraft({ ...draft, phone: v })} placeholder="Phone Number" />
                {errors.phone ? <Text style={styles.error}>{errors.phone}</Text> : null}
                <AppInput editable={editMode} value={(draft as ClubDetail).city ?? ""} onChangeText={(v) => setDraft({ ...draft, city: v })} placeholder="City" />
                {errors.city ? <Text style={styles.error}>{errors.city}</Text> : null}
                <AppInput editable={editMode} value={(draft as ClubDetail).state ?? ""} onChangeText={(v) => setDraft({ ...draft, state: v })} placeholder="State" />
                {errors.state ? <Text style={styles.error}>{errors.state}</Text> : null}
                <AppInput editable={editMode} value={(draft as ClubDetail).country ?? ""} onChangeText={(v) => setDraft({ ...draft, country: v })} placeholder="Country" />
                {errors.country ? <Text style={styles.error}>{errors.country}</Text> : null}
                <AppInput editable={editMode} value={(draft as ClubDetail).clubName} onChangeText={(v) => setDraft({ ...draft, clubName: v })} placeholder="Club Name" />
                {errors.clubName ? <Text style={styles.error}>{errors.clubName}</Text> : null}
                <AppInput editable={false} value={(draft as ClubDetail).clubUsername} placeholder="Club Username (read-only)" />
                <AppInput editable={editMode} value={(draft as ClubDetail).adminName} onChangeText={(v) => setDraft({ ...draft, adminName: v })} placeholder="Admin/Moderator Name" />
                {errors.adminName ? <Text style={styles.error}>{errors.adminName}</Text> : null}
                <AppInput editable={editMode} multiline value={(draft as ClubDetail).about} onChangeText={(v) => setDraft({ ...draft, about: v })} placeholder="About Club" />
                {errors.about ? <Text style={styles.error}>{errors.about}</Text> : null}
                <AppInput
                  editable={editMode}
                  value={(draft as ClubDetail).facebookUrl ?? ""}
                  onChangeText={(v) => setDraft({ ...draft, facebookUrl: v })}
                  placeholder="Facebook URL"
                  autoCapitalize="none"
                />
                <AppInput
                  editable={editMode}
                  value={(draft as ClubDetail).instagramUrl ?? ""}
                  onChangeText={(v) => setDraft({ ...draft, instagramUrl: v })}
                  placeholder="Instagram URL"
                  autoCapitalize="none"
                />
                <Text style={styles.meta}>Members: {(draft as ClubDetail).memberCount}</Text>
                <Text style={styles.meta}>Identity Verification: {(draft as ClubDetail).identityVerificationStatus}</Text>
              </>
            )}

            {editMode ? (
              <View style={styles.saveRow}>
                <AppButton label={saving ? "Saving..." : "Save / Update"} onPress={saveProfile} disabled={saving} />
                {isDirty ? <Text style={styles.unsaved}>Unsaved changes</Text> : null}
              </View>
            ) : null}
          </SurfaceCard>
        )}

        <AppButton label="Sign Out" variant="secondary" onPress={clearSession} />
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  content: {
    paddingBottom: 120,
    gap: theme.spacing.sm,
  },
  tabRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  tab: {
    flex: 1,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: theme.colors.background.tertiary,
  },
  tabActive: {
    borderColor: theme.colors.brand.primary,
    backgroundColor: theme.colors.background.elevated,
  },
  tabText: {
    color: theme.colors.text.primary,
    fontWeight: "700",
  },
  title: {
    color: theme.colors.text.primary,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: theme.spacing.xs,
  },
  sectionTitle: {
    color: theme.colors.text.primary,
    fontWeight: "800",
    fontSize: 17,
  },
  meta: {
    color: theme.colors.text.secondary,
    marginTop: 4,
  },
  help: {
    color: theme.colors.text.muted,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  label: {
    color: theme.colors.text.secondary,
    fontWeight: "700",
    marginBottom: theme.spacing.xs,
  },
  bikeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  bikeInput: {
    flex: 1,
    marginBottom: 0,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  tag: {
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.background.elevated,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: {
    color: theme.colors.text.primary,
    fontWeight: "700",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  checkText: {
    color: theme.colors.text.secondary,
  },
  error: {
    color: theme.colors.danger,
    marginTop: -4,
    marginBottom: 8,
    fontSize: 12,
  },
  saveRow: {
    marginTop: theme.spacing.sm,
  },
  unsaved: {
    color: theme.colors.brand.highlight,
    marginTop: 4,
    fontSize: 12,
  },
});
