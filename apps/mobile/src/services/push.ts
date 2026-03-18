import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { api } from "./api";

export function initPushNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF8A00",
    }).catch(() => undefined);
  }
}

function normalizePlatform(): "android" | "ios" | "web" {
  if (Platform.OS === "android") return "android";
  if (Platform.OS === "ios") return "ios";
  return "web";
}

export async function getPushTokenForAuth(): Promise<{ token: string; platform: "android" | "ios" | "web" } | null> {
  if (Platform.OS === "web") return null;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") return null;

  const tokenResult = await Notifications.getDevicePushTokenAsync();
  const token = String(tokenResult.data ?? "");
  if (!token) return null;
  return { token, platform: normalizePlatform() };
}

export async function registerDeviceToken(): Promise<void> {
  const authToken = await getPushTokenForAuth();
  if (!authToken) return;

  await api.post("/api/notifications/device-token", {
    token: authToken.token,
    platform: authToken.platform,
  });
}
