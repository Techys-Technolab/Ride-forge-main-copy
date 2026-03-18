import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, View } from "react-native";
import { theme } from "../theme/theme";

export const Screen = ({ children }: { children: React.ReactNode }) => (
  <SafeAreaView style={styles.root}>
    <View style={styles.glowTop} />
    <View style={styles.glowBottom} />
    <View style={styles.content}>{children}</View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  glowTop: {
    position: "absolute",
    top: -120,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(255, 138, 0, 0.14)",
  },
  glowBottom: {
    position: "absolute",
    bottom: -110,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(0, 194, 255, 0.12)",
  },
});
