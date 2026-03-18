import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { SurfaceCard } from "../components/SurfaceCard";
import { ScreenTitle } from "../components/ScreenTitle";
import { api } from "../services/api";
import { getPushTokenForAuth } from "../services/push";
import { useAuthStore } from "../state/authStore";
import { theme } from "../theme/theme";

export const SignInScreen = ({ navigation }: any) => {
  const [login, setLogin] = useState("rider@example.com");
  const [password, setPassword] = useState("StrongPass1");
  const [showForgot, setShowForgot] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const setSession = useAuthStore((s) => s.setSession);

  const signIn = async () => {
    try {
      const push = await getPushTokenForAuth();
      const data = await api.post<any>("/api/auth/login", {
        login,
        password,
        deviceToken: push?.token,
        devicePlatform: push?.platform,
      });
      setSession({ accessToken: data.tokens.accessToken, refreshToken: data.tokens.refreshToken, user: data.user });
    } catch (error) {
      Alert.alert("Sign in failed", String(error));
    }
  };

  const requestResetCode = async () => {
    try {
      const data = await api.post<any>("/api/auth/forgot-password/request", { login, channel: "email" });
      Alert.alert("Reset code sent", data.devCode ? `Dev code: ${data.devCode}` : "Check your email for the reset code.");
      setShowForgot(true);
    } catch (error) {
      Alert.alert("Reset failed", String(error));
    }
  };

  const confirmReset = async () => {
    try {
      await api.post("/api/auth/forgot-password/confirm", {
        login,
        channel: "email",
        code: resetCode,
        newPassword,
      });
      setPassword(newPassword);
      setResetCode("");
      setNewPassword("");
      setShowForgot(false);
      Alert.alert("Password updated", "Your password has been reset. Please sign in.");
    } catch (error) {
      Alert.alert("Reset confirm failed", String(error));
    }
  };

  return (
    <Screen>
      <View style={styles.root}>
        <ScreenTitle title="Rideforge" subtitle="Welcome back. Gear up and continue your ride." />
        <SurfaceCard style={styles.card}>
          <AppInput value={login} onChangeText={setLogin} placeholder="Email or username" autoCapitalize="none" keyboardType="email-address" />
          <AppInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" />
          <AppButton label="Sign In" onPress={signIn} />
          <AppButton label={showForgot ? "Hide Forgot Password" : "Forgot Password"} variant="secondary" onPress={() => setShowForgot((v) => !v)} />
          {showForgot ? (
            <>
              <Text style={styles.forgotTitle}>Forgot Password</Text>
              <Text style={styles.tip}>Use your email/username above, request code, then set new password.</Text>
              <AppButton label="Send Reset Code" variant="secondary" onPress={requestResetCode} />
              <AppInput value={resetCode} onChangeText={setResetCode} placeholder="Reset code (6 digits)" keyboardType="number-pad" />
              <AppInput value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="New password" />
              <AppButton label="Reset Password" onPress={confirmReset} disabled={!resetCode || !newPassword} />
            </>
          ) : null}
          <AppButton label="Create Account" variant="secondary" onPress={() => navigation.navigate("SignUp")} />
          <Text style={styles.tip}>Tip: use strong mobile network for live tracking and chat sync.</Text>
        </SurfaceCard>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
  },
  card: {
    paddingTop: theme.spacing.lg,
  },
  tip: {
    color: theme.colors.text.muted,
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.caption,
  },
  forgotTitle: {
    color: theme.colors.text.primary,
    fontWeight: "800",
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
});
