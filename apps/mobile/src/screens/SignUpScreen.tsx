import React, { useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Screen } from "../components/Screen";
import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { SurfaceCard } from "../components/SurfaceCard";
import { ScreenTitle } from "../components/ScreenTitle";
import { api } from "../services/api";
import { getPushTokenForAuth } from "../services/push";
import { useAuthStore } from "../state/authStore";
import { theme } from "../theme/theme";

type AccountType = "rider" | "club";
type Channel = "email" | "phone";

type VerificationState = {
  userId: string;
  emailCode: string;
  phoneCode: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  emailDevCode?: string;
  phoneDevCode?: string;
};

const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/;
const URL_REGEX = /^https?:\/\/.+/i;

export const SignUpScreen = () => {
  const setSession = useAuthStore((s) => s.setSession);
  const [accountType, setAccountType] = useState<AccountType>("rider");
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [verification, setVerification] = useState<VerificationState | null>(null);
  const [rider, setRider] = useState({
    profilePictureUrl: "https://example.com/avatar.jpg",
    username: "test_rider",
    password: "TestPassword123",
    fullName: "Test Rider",
    phone: "+12025550123",
    email: "test.rider@example.com",
    bloodGroup: "O+",
    emergencyContactName: "Test Emergency",
    emergencyContactNumber: "+12025550199",
    city: "New York",
    state: "NY",
    country: "USA",
    bikeModelsInput: "",
    bikeModels: ["Yamaha MT-07"] as string[],
    clubName: "",
    isSoloRider: true,
  });
  const [club, setClub] = useState({
    logoUrl: "",
    username: "",
    password: "",
    clubName: "",
    adminName: "",
    about: "",
    phone: "",
    email: "",
    city: "",
    state: "",
    country: "",
    facebookUrl: "",
    instagramUrl: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const addBikeModel = () => {
    const value = rider.bikeModelsInput.trim();
    if (!value) return;
    if (rider.bikeModels.some((model) => model.toLowerCase() === value.toLowerCase())) {
      return;
    }
    if (rider.bikeModels.length >= 8) {
      Alert.alert("Limit reached", "Maximum 8 bike models are allowed.");
      return;
    }
    setRider((prev) => ({ ...prev, bikeModels: [...prev.bikeModels, value], bikeModelsInput: "" }));
  };

  const removeBikeModel = (name: string) => {
    setRider((prev) => ({ ...prev, bikeModels: prev.bikeModels.filter((model) => model !== name) }));
  };

  const pickImage = async (target: "rider" | "club") => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Allow photo library access to upload image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 0.9,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const size = asset.fileSize ?? 0;
    if (size > 5 * 1024 * 1024) {
      Alert.alert("Image too large", "Maximum allowed image size is 5MB.");
      return;
    }
    const uri = asset.uri;
    if (!uri.toLowerCase().match(/\.(jpg|jpeg|png)$/)) {
      Alert.alert("Unsupported format", "Use JPG or PNG images only.");
      return;
    }

    if (target === "rider") {
      setRider((prev) => ({ ...prev, profilePictureUrl: uri }));
    } else {
      setClub((prev) => ({ ...prev, logoUrl: uri }));
    }
  };

  const validate = useMemo(() => {
    return () => {
      const next: Record<string, string> = {};
      if (accountType === "rider") {
        if (!rider.profilePictureUrl) next.profilePictureUrl = "Profile picture is required";
        if (rider.username.trim().length < 3) next.username = "Username must be at least 3 characters";
        if (!PASSWORD_REGEX.test(rider.password)) next.password = "Use 10+ chars with uppercase, lowercase, and number";
        if (!rider.fullName.trim()) next.fullName = "Full name is required";
        if (!PHONE_REGEX.test(rider.phone.trim())) next.phone = "Enter a valid phone number";
        if (!EMAIL_REGEX.test(rider.email.trim())) next.email = "Enter a valid email";
        if (!rider.bloodGroup.trim()) next.bloodGroup = "Blood group is required";
        if (!rider.emergencyContactName.trim()) next.emergencyContactName = "Emergency contact name is required";
        if (!PHONE_REGEX.test(rider.emergencyContactNumber.trim())) next.emergencyContactNumber = "Valid emergency phone is required";
        if (!rider.city.trim()) next.city = "City is required";
        if (!rider.state.trim()) next.state = "State is required";
        if (!rider.country.trim()) next.country = "Country is required";
        if (rider.bikeModels.length === 0) next.bikeModels = "Add at least one bike model";
        if (!rider.isSoloRider && !rider.clubName.trim()) next.clubName = "Club name is required";
      } else {
        if (!club.logoUrl) next.logoUrl = "Club logo is required";
        if (club.username.trim().length < 3) next.username = "Club username must be at least 3 characters";
        if (!PASSWORD_REGEX.test(club.password)) next.password = "Use 10+ chars with uppercase, lowercase, and number";
        if (!club.clubName.trim()) next.clubName = "Club name is required";
        if (!club.adminName.trim()) next.adminName = "Admin/Moderator name is required";
        if (club.about.trim().length < 10) next.about = "About Club should be at least 10 characters";
        if (!PHONE_REGEX.test(club.phone.trim())) next.phone = "Enter a valid phone number";
        if (!EMAIL_REGEX.test(club.email.trim())) next.email = "Enter a valid email";
        if (!club.city.trim()) next.city = "City is required";
        if (!club.state.trim()) next.state = "State is required";
        if (!club.country.trim()) next.country = "Country is required";
        if (club.facebookUrl.trim() && !URL_REGEX.test(club.facebookUrl.trim())) next.facebookUrl = "Invalid Facebook URL";
        if (club.instagramUrl.trim() && !URL_REGEX.test(club.instagramUrl.trim())) next.instagramUrl = "Invalid Instagram URL";
      }
      setErrors(next);
      return Object.keys(next).length === 0;
    };
  }, [accountType, rider, club]);

  const submit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      if (accountType === "rider") {
        const data = await api.post<any>("/api/auth/signup/rider", {
          accountType: "rider",
          username: rider.username.trim(),
          password: rider.password,
          fullName: rider.fullName.trim(),
          phone: rider.phone.trim(),
          email: rider.email.trim(),
          bloodGroup: rider.bloodGroup.trim(),
          emergencyContactName: rider.emergencyContactName.trim(),
          emergencyContactNumber: rider.emergencyContactNumber.trim(),
          city: rider.city.trim(),
          state: rider.state.trim(),
          country: rider.country.trim(),
          bikeModels: rider.bikeModels,
          clubName: rider.isSoloRider ? undefined : rider.clubName.trim(),
          isSoloRider: rider.isSoloRider,
          profilePictureUrl: rider.profilePictureUrl,
        });
        setVerification({
          userId: data.verification.userId,
          emailCode: "",
          phoneCode: "",
          emailVerified: false,
          phoneVerified: false,
          emailDevCode: data.verification?.devCodes?.emailOtp,
          phoneDevCode: data.verification?.devCodes?.phoneOtp,
        });
      } else {
        const data = await api.post<any>("/api/auth/signup/club", {
          accountType: "club",
          username: club.username.trim(),
          password: club.password,
          clubName: club.clubName.trim(),
          adminName: club.adminName.trim(),
          about: club.about.trim(),
          phone: club.phone.trim(),
          email: club.email.trim(),
          city: club.city.trim(),
          state: club.state.trim(),
          country: club.country.trim(),
          facebookUrl: club.facebookUrl.trim() || undefined,
          instagramUrl: club.instagramUrl.trim() || undefined,
          clubLogoUrl: club.logoUrl,
        });
        setVerification({
          userId: data.verification.userId,
          emailCode: "",
          phoneCode: "",
          emailVerified: false,
          phoneVerified: false,
          emailDevCode: data.verification?.devCodes?.emailOtp,
          phoneDevCode: data.verification?.devCodes?.phoneOtp,
        });
      }
      setStep(2);
      Alert.alert("Verification required", "Please verify both email and phone OTP to activate your account.");
    } catch (error) {
      Alert.alert("Sign up failed", String(error));
    } finally {
      setLoading(false);
    }
  };

  const verifyChannel = async (channel: Channel) => {
    if (!verification) return;
    const code = channel === "email" ? verification.emailCode : verification.phoneCode;
    if (code.length !== 6) {
      Alert.alert("Invalid code", "OTP must be a 6-digit code.");
      return;
    }

    setLoading(true);
    try {
      const data = await api.post<any>("/api/auth/verify", { userId: verification.userId, channel, code });
      const next = {
        ...verification,
        emailVerified: channel === "email" ? true : verification.emailVerified,
        phoneVerified: channel === "phone" ? true : verification.phoneVerified,
      };
      setVerification(next);
      if (data.verification?.isFullyVerified) {
        const push = await getPushTokenForAuth();
        const loginPayload =
          accountType === "rider"
            ? { login: rider.email.trim(), password: rider.password, deviceToken: push?.token, devicePlatform: push?.platform }
            : { login: club.email.trim(), password: club.password, deviceToken: push?.token, devicePlatform: push?.platform };
        const loginData = await api.post<any>("/api/auth/login", loginPayload);
        setSession({ accessToken: loginData.tokens.accessToken, refreshToken: loginData.tokens.refreshToken, user: loginData.user });
      } else {
        Alert.alert("Verification updated", `${channel} verified successfully.`);
      }
    } catch (error) {
      Alert.alert("Verification failed", String(error));
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async (channel: Channel) => {
    if (!verification) return;
    try {
      const response = await api.post<any>("/api/auth/verify/resend", { userId: verification.userId, channel });
      if (channel === "email") {
        setVerification((prev) => (prev ? { ...prev, emailDevCode: response.devCode } : prev));
      } else {
        setVerification((prev) => (prev ? { ...prev, phoneDevCode: response.devCode } : prev));
      }
      Alert.alert("OTP sent", `${channel} OTP resent successfully.`);
    } catch (error) {
      Alert.alert("Resend failed", String(error));
    }
  };

  const errorText = (field: string) => (errors[field] ? <Text style={styles.error}>{errors[field]}</Text> : null);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle title="Create Rideforge Account" subtitle="Choose account type and complete secure onboarding." />
        {step === 1 ? (
          <>
            <SurfaceCard>
              <Text style={styles.label}>Registration Type</Text>
              <View style={styles.choiceRow}>
                <Pressable
                  style={[styles.choice, accountType === "rider" && styles.choiceActive]}
                  onPress={() => setAccountType("rider")}
                >
                  <Text style={styles.choiceTitle}>Register as Rider</Text>
                </Pressable>
                <Pressable
                  style={[styles.choice, accountType === "club" && styles.choiceActive]}
                  onPress={() => setAccountType("club")}
                >
                  <Text style={styles.choiceTitle}>Register as Riding Club</Text>
                </Pressable>
              </View>
            </SurfaceCard>

            {accountType === "rider" ? (
              <SurfaceCard>
                <Text style={styles.sectionTitle}>Rider Registration</Text>
                <AppButton label="Upload Profile Picture (JPG/PNG <= 5MB)" variant="secondary" onPress={() => pickImage("rider")} />
                {rider.profilePictureUrl ? <Image source={{ uri: rider.profilePictureUrl }} style={styles.preview} /> : null}
                {errorText("profilePictureUrl")}
                <AppInput value={rider.username} onChangeText={(v) => setRider((s) => ({ ...s, username: v }))} placeholder="User Name" autoCapitalize="none" />
                {errorText("username")}
                <AppInput value={rider.password} onChangeText={(v) => setRider((s) => ({ ...s, password: v }))} placeholder="Password" secureTextEntry />
                {errorText("password")}
                <AppInput value={rider.fullName} onChangeText={(v) => setRider((s) => ({ ...s, fullName: v }))} placeholder="Full Name" />
                {errorText("fullName")}
                <AppInput value={rider.phone} onChangeText={(v) => setRider((s) => ({ ...s, phone: v }))} placeholder="Phone Number (+countrycode)" keyboardType="phone-pad" />
                {errorText("phone")}
                <AppInput value={rider.email} onChangeText={(v) => setRider((s) => ({ ...s, email: v }))} placeholder="Email Address" autoCapitalize="none" keyboardType="email-address" />
                {errorText("email")}
                <AppInput value={rider.bloodGroup} onChangeText={(v) => setRider((s) => ({ ...s, bloodGroup: v }))} placeholder="Blood Group (e.g. O+)" />
                {errorText("bloodGroup")}
                <AppInput value={rider.emergencyContactName} onChangeText={(v) => setRider((s) => ({ ...s, emergencyContactName: v }))} placeholder="Emergency Contact Name" />
                {errorText("emergencyContactName")}
                <AppInput value={rider.emergencyContactNumber} onChangeText={(v) => setRider((s) => ({ ...s, emergencyContactNumber: v }))} placeholder="Emergency Contact Number (+countrycode)" keyboardType="phone-pad" />
                {errorText("emergencyContactNumber")}
                <AppInput value={rider.city} onChangeText={(v) => setRider((s) => ({ ...s, city: v }))} placeholder="City" />
                {errorText("city")}
                <AppInput value={rider.state} onChangeText={(v) => setRider((s) => ({ ...s, state: v }))} placeholder="State" />
                {errorText("state")}
                <AppInput value={rider.country} onChangeText={(v) => setRider((s) => ({ ...s, country: v }))} placeholder="Country" />
                {errorText("country")}

                <Text style={styles.label}>Current Bike Model(s)</Text>
                <View style={styles.bikeRow}>
                  <AppInput
                    style={styles.bikeInput}
                    value={rider.bikeModelsInput}
                    onChangeText={(v) => setRider((s) => ({ ...s, bikeModelsInput: v }))}
                    placeholder="Add bike model and tap +"
                  />
                  <Pressable style={styles.plus} onPress={addBikeModel}>
                    <Text style={styles.plusText}>+</Text>
                  </Pressable>
                </View>
                {errorText("bikeModels")}
                <View style={styles.tags}>
                  {rider.bikeModels.map((model) => (
                    <Pressable key={model} style={styles.tag} onPress={() => removeBikeModel(model)}>
                      <Text style={styles.tagText}>{model} x</Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.checkRow}>
                  <Switch value={rider.isSoloRider} onValueChange={(value) => setRider((s) => ({ ...s, isSoloRider: value }))} />
                  <Text style={styles.checkText}>I am not currently a member of any club. Register me as a Solo Rider.</Text>
                </View>
                {!rider.isSoloRider ? (
                  <>
                    <AppInput value={rider.clubName} onChangeText={(v) => setRider((s) => ({ ...s, clubName: v }))} placeholder="Club Name" />
                    {errorText("clubName")}
                  </>
                ) : null}
              </SurfaceCard>
            ) : (
              <SurfaceCard>
                <Text style={styles.sectionTitle}>Riding Club Registration</Text>
                <AppButton label="Upload Club Logo (JPG/PNG <= 5MB)" variant="secondary" onPress={() => pickImage("club")} />
                {club.logoUrl ? <Image source={{ uri: club.logoUrl }} style={styles.preview} /> : null}
                {errorText("logoUrl")}
                <AppInput value={club.username} onChangeText={(v) => setClub((s) => ({ ...s, username: v }))} placeholder="Club User Name" autoCapitalize="none" />
                {errorText("username")}
                <AppInput value={club.password} onChangeText={(v) => setClub((s) => ({ ...s, password: v }))} placeholder="Password" secureTextEntry />
                {errorText("password")}
                <AppInput value={club.clubName} onChangeText={(v) => setClub((s) => ({ ...s, clubName: v }))} placeholder="Club Name" />
                {errorText("clubName")}
                <AppInput value={club.adminName} onChangeText={(v) => setClub((s) => ({ ...s, adminName: v }))} placeholder="Club Admin/Moderator Name" />
                {errorText("adminName")}
                <AppInput value={club.about} onChangeText={(v) => setClub((s) => ({ ...s, about: v }))} placeholder="About Club" multiline />
                {errorText("about")}
                <AppInput value={club.phone} onChangeText={(v) => setClub((s) => ({ ...s, phone: v }))} placeholder="Phone Number (+countrycode)" keyboardType="phone-pad" />
                {errorText("phone")}
                <AppInput value={club.email} onChangeText={(v) => setClub((s) => ({ ...s, email: v }))} placeholder="Email Address" autoCapitalize="none" keyboardType="email-address" />
                {errorText("email")}
                <AppInput value={club.city} onChangeText={(v) => setClub((s) => ({ ...s, city: v }))} placeholder="City" />
                {errorText("city")}
                <AppInput value={club.state} onChangeText={(v) => setClub((s) => ({ ...s, state: v }))} placeholder="State" />
                {errorText("state")}
                <AppInput value={club.country} onChangeText={(v) => setClub((s) => ({ ...s, country: v }))} placeholder="Country" />
                {errorText("country")}
                <AppInput value={club.facebookUrl} onChangeText={(v) => setClub((s) => ({ ...s, facebookUrl: v }))} placeholder="Facebook URL (optional)" autoCapitalize="none" />
                {errorText("facebookUrl")}
                <AppInput value={club.instagramUrl} onChangeText={(v) => setClub((s) => ({ ...s, instagramUrl: v }))} placeholder="Instagram URL (optional)" autoCapitalize="none" />
                {errorText("instagramUrl")}
              </SurfaceCard>
            )}
            <AppButton label={loading ? "Creating..." : "Create Account"} onPress={submit} disabled={loading} />
          </>
        ) : (
          <SurfaceCard>
            <Text style={styles.sectionTitle}>Verify Your Account</Text>
            <Text style={styles.help}>Complete email and phone OTP verification to unlock full access.</Text>
            {verification?.emailDevCode ? <Text style={styles.devText}>Dev email OTP: {verification.emailDevCode}</Text> : null}
            <AppInput
              value={verification?.emailCode ?? ""}
              onChangeText={(v) => setVerification((prev) => (prev ? { ...prev, emailCode: v } : prev))}
              placeholder="Email OTP (6 digits)"
              keyboardType="number-pad"
              editable={!verification?.emailVerified}
            />
            <View style={styles.row}>
              <AppButton label={verification?.emailVerified ? "Email Verified" : "Verify Email"} onPress={() => verifyChannel("email")} disabled={loading || !!verification?.emailVerified} />
              <AppButton label="Resend Email OTP" variant="secondary" onPress={() => resendCode("email")} disabled={loading} />
            </View>

            {verification?.phoneDevCode ? <Text style={styles.devText}>Dev phone OTP: {verification.phoneDevCode}</Text> : null}
            <AppInput
              value={verification?.phoneCode ?? ""}
              onChangeText={(v) => setVerification((prev) => (prev ? { ...prev, phoneCode: v } : prev))}
              placeholder="Phone OTP (6 digits)"
              keyboardType="number-pad"
              editable={!verification?.phoneVerified}
            />
            <View style={styles.row}>
              <AppButton label={verification?.phoneVerified ? "Phone Verified" : "Verify Phone"} onPress={() => verifyChannel("phone")} disabled={loading || !!verification?.phoneVerified} />
              <AppButton label="Resend Phone OTP" variant="secondary" onPress={() => resendCode("phone")} disabled={loading} />
            </View>
          </SurfaceCard>
        )}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingVertical: 20,
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    color: theme.colors.text.primary,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: theme.spacing.sm,
  },
  label: {
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
    fontWeight: "700",
  },
  choiceRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  choice: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background.tertiary,
  },
  choiceActive: {
    borderColor: theme.colors.brand.primary,
    backgroundColor: theme.colors.background.elevated,
  },
  choiceTitle: {
    color: theme.colors.text.primary,
    fontWeight: "800",
    textAlign: "center",
  },
  preview: {
    width: 96,
    height: 96,
    borderRadius: 12,
    marginBottom: theme.spacing.sm,
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
  plus: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.brand.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.sm,
  },
  plusText: {
    color: theme.colors.background.primary,
    fontSize: 24,
    fontWeight: "800",
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  tag: {
    backgroundColor: theme.colors.background.elevated,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
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
    flex: 1,
    color: theme.colors.text.secondary,
    fontSize: 13,
  },
  error: {
    color: theme.colors.danger,
    marginTop: -4,
    marginBottom: 8,
    fontSize: 12,
  },
  row: {
    marginBottom: theme.spacing.sm,
  },
  help: {
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  },
  devText: {
    color: theme.colors.brand.highlight,
    marginBottom: theme.spacing.xs,
    fontSize: 12,
  },
});
