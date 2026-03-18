import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../theme/theme";

export const ScreenTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <View style={styles.wrap}>
    <Text style={styles.title}>{title}</Text>
    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    marginBottom: theme.spacing.md,
  },
  title: {
    color: theme.colors.text.primary,
    fontSize: theme.typography.title,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  subtitle: {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.subtitle,
    marginTop: 4,
  },
});
