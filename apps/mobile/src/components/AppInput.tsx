import React from "react";
import { StyleSheet, TextInput, TextInputProps } from "react-native";
import { theme } from "../theme/theme";

export const AppInput = (props: TextInputProps) => (
  <TextInput
    placeholderTextColor={theme.colors.text.muted}
    accessibilityLabel={props.placeholder ?? "Input"}
    {...props}
    style={[styles.input, props.style]}
  />
);

const styles = StyleSheet.create({
  input: {
    backgroundColor: theme.colors.background.tertiary,
    borderColor: theme.colors.border,
    borderWidth: 1,
    color: theme.colors.text.primary,
    borderRadius: theme.radius.md,
    minHeight: 48,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    fontSize: 16,
    marginBottom: theme.spacing.sm,
  },
});
