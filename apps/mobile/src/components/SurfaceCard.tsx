import React from "react";
import { StyleSheet, View, ViewProps } from "react-native";
import { theme } from "../theme/theme";

export const SurfaceCard = ({ style, ...rest }: ViewProps) => <View {...rest} style={[styles.card, style]} />;

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.background.secondary,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
});
