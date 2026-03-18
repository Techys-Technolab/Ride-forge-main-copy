import React, { useEffect } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { theme } from "../theme/theme";

export const SplashHandoffScreen = ({ onFinished }: { onFinished: () => void }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) });
    const timer = setTimeout(onFinished, 1700);
    return () => clearTimeout(timer);
  }, [onFinished, progress]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { scale: interpolate(progress.value, [0, 1], [0.8, 1]) },
      { translateY: interpolate(progress.value, [0, 1], [20, 0]) },
    ],
  }));

  return (
    <View style={styles.root}>
      <View style={styles.glow} />
      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <Image source={require("../../assets/splash.png")} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Rideforge</Text>
        <Text style={styles.subtitle}>Brotherhood on Every Mile</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  glow: {
    position: "absolute",
    width: 290,
    height: 290,
    borderRadius: 145,
    backgroundColor: "rgba(255, 138, 0, 0.17)",
  },
  logoWrap: { alignItems: "center" },
  logo: { width: 180, height: 180, marginBottom: 14 },
  title: {
    color: theme.colors.text.primary,
    fontSize: 38,
    fontWeight: "900",
  },
  subtitle: {
    color: theme.colors.text.secondary,
    fontSize: 14,
    marginTop: 6,
  },
});
