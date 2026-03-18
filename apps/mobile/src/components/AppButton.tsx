import React from "react";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { theme } from "../theme/theme";

interface AppButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  style?: ViewStyle;
}

export const AppButton = ({ label, onPress, disabled, variant = "primary", style }: AppButtonProps) => (
  <Pressable
    style={({ pressed }) => [
      styles.button,
      variant === "secondary" ? styles.secondary : styles.primary,
      pressed && !disabled ? styles.pressed : undefined,
      disabled ? styles.disabled : undefined,
      style,
    ]}
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled: Boolean(disabled) }}
    hitSlop={6}
  >
    <Text style={[styles.text, variant === "secondary" ? styles.secondaryText : undefined]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.sm + 3,
    paddingHorizontal: theme.spacing.md,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: theme.spacing.xs,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  primary: {
    backgroundColor: theme.colors.brand.primary,
    borderColor: theme.colors.brand.highlight,
  },
  secondary: {
    backgroundColor: theme.colors.background.tertiary,
    borderColor: theme.colors.border,
  },
  text: {
    color: theme.colors.background.primary,
    fontWeight: "800",
    letterSpacing: 0.2,
    fontSize: theme.typography.body,
  },
  secondaryText: {
    color: theme.colors.text.primary,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.94,
  },
  disabled: {
    opacity: 0.55,
  },
});
