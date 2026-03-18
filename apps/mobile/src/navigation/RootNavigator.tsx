import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StyleSheet, Text } from "react-native";
import { useAuthStore } from "../state/authStore";
import { SignInScreen } from "../screens/SignInScreen";
import { SignUpScreen } from "../screens/SignUpScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { RideTrackerScreen } from "../screens/RideTrackerScreen";
import { RouteStudioScreen } from "../screens/RouteStudioScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { ChatScreen } from "../screens/ChatScreen";
import { StoreScreen } from "../screens/StoreScreen";
import { ChallengesScreen } from "../screens/ChallengesScreen";
import { MapHubScreen } from "../screens/MapHubScreen";
import { FeedScreen } from "../screens/FeedScreen";
import { EventsScreen } from "../screens/EventsScreen";
import { ClubsScreen } from "../screens/ClubsScreen";
import { theme } from "../theme/theme";

const AuthStack = createNativeStackNavigator();
const AppTabs = createBottomTabNavigator();

function MainTabs() {
  const icon = (glyph: string) => <Text style={styles.icon}>{glyph}</Text>;

  return (
    <AppTabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarActiveTintColor: theme.colors.brand.primary,
        tabBarInactiveTintColor: theme.colors.text.muted,
      }}
    >
      <AppTabs.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: () => icon("H") }} />
      <AppTabs.Screen name="Ride" component={RideTrackerScreen} options={{ tabBarIcon: () => icon("R") }} />
      <AppTabs.Screen name="Routes" component={RouteStudioScreen} options={{ tabBarIcon: () => icon("RT") }} />
      <AppTabs.Screen name="Maps" component={MapHubScreen} options={{ tabBarIcon: () => icon("M") }} />
      <AppTabs.Screen name="Feed" component={FeedScreen} options={{ tabBarIcon: () => icon("F") }} />
      <AppTabs.Screen name="Ride&Events" component={EventsScreen} options={{ tabBarIcon: () => icon("E") }} />
      <AppTabs.Screen name="Clubs" component={ClubsScreen} options={{ tabBarIcon: () => icon("CL") }} />
      <AppTabs.Screen name="Chat" component={ChatScreen} options={{ tabBarIcon: () => icon("C") }} />
      <AppTabs.Screen name="Store" component={StoreScreen} options={{ tabBarIcon: () => icon("S") }} />
      <AppTabs.Screen name="Challenges" component={ChallengesScreen} options={{ tabBarIcon: () => icon("CH") }} />
      <AppTabs.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: () => icon("P") }} />
    </AppTabs.Navigator>
  );
}

export const RootNavigator = () => {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return (
      <AuthStack.Navigator screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="SignIn" component={SignInScreen} />
        <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      </AuthStack.Navigator>
    );
  }

  return <MainTabs />;
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: theme.colors.background.secondary,
    borderTopColor: theme.colors.border,
    height: 70,
    paddingTop: 6,
    paddingBottom: 8,
  },
  tabLabel: {
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.2,
  },
  icon: {
    color: theme.colors.brand.accent,
    fontWeight: "800",
    fontSize: 13,
  },
});
