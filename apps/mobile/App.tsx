import "react-native-gesture-handler";
import React, { useCallback, useEffect, useState } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { SplashHandoffScreen } from "./src/screens/SplashHandoffScreen";
import { initPushNotifications, registerDeviceToken } from "./src/services/push";
import { useAuthStore } from "./src/state/authStore";
import { theme } from "./src/theme/theme";

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: theme.colors.background.primary,
    card: theme.colors.background.secondary,
    text: theme.colors.text.primary,
    border: theme.colors.border,
    primary: theme.colors.brand.primary,
  },
};

export default function App() {
  const [showHandoff, setShowHandoff] = useState(true);
  const finishHandoff = useCallback(() => setShowHandoff(false), []);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    initPushNotifications();
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    registerDeviceToken().catch((error) => {
      console.warn("Device token registration failed", error);
    });
  }, [accessToken]);

  if (showHandoff) {
    return (
      <>
        <StatusBar style="light" />
        <SplashHandoffScreen onFinished={finishHandoff} />
      </>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <RootNavigator />
    </NavigationContainer>
  );
}
