import React, { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { SurfaceCard } from "../components/SurfaceCard";
import { ScreenTitle } from "../components/ScreenTitle";
import { api } from "../services/api";
import { useDataStore } from "../state/dataStore";
import { theme } from "../theme/theme";

export const HomeScreen = () => {
  const recentRides = useDataStore((s) => s.recentRides);
  const setRecentRides = useDataStore((s) => s.setRecentRides);
  const [rewardPoints, setRewardPoints] = useState(0);

  useEffect(() => {
    api.get<any[]>("/api/rides").then(setRecentRides).catch(() => undefined);
    api.get<{ points: number }>("/api/rewards/balance").then((data) => setRewardPoints(data.points)).catch(() => undefined);
  }, [setRecentRides]);

  const totalDistance = recentRides.reduce((sum, ride) => sum + Number(ride.distanceKm ?? 0), 0);

  return (
    <Screen>
      <ScreenTitle title="Rider Control Center" subtitle="Track progress, earn rewards, and stay road-ready." />
      <SurfaceCard style={styles.hero}>
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{totalDistance.toFixed(1)} km</Text>
            <Text style={styles.metricLabel}>Distance logged</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{rewardPoints} pts</Text>
            <Text style={styles.metricLabel}>Rewards balance</Text>
          </View>
        </View>
      </SurfaceCard>

      <Text style={styles.section}>Recent Rides</Text>
      <FlatList
        data={recentRides}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SurfaceCard style={styles.card}>
            <Text style={styles.cardTitle}>{new Date(item.startedAt).toLocaleString()}</Text>
            <Text style={styles.cardText}>
              {item.distanceKm.toFixed(1)} km | Avg {item.avgSpeedKmh.toFixed(1)} km/h
            </Text>
          </SurfaceCard>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No rides yet. Start your first ride from the Ride tab.</Text>}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  hero: {
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.background.elevated,
  },
  metricsRow: { flexDirection: "row", gap: theme.spacing.sm },
  metricCard: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
  },
  metricValue: { color: theme.colors.brand.highlight, fontSize: 22, fontWeight: "900" },
  metricLabel: { color: theme.colors.text.secondary, fontSize: 13 },
  section: { color: theme.colors.brand.primary, fontWeight: "800", marginBottom: theme.spacing.sm },
  card: { marginBottom: theme.spacing.sm },
  cardTitle: { color: theme.colors.text.primary, fontWeight: "700" },
  cardText: { color: theme.colors.text.secondary, marginTop: 4 },
  empty: { color: theme.colors.text.muted, marginTop: theme.spacing.md },
});
