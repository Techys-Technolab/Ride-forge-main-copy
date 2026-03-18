import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import { Screen } from "../components/Screen";
import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { SurfaceCard } from "../components/SurfaceCard";
import { ScreenTitle } from "../components/ScreenTitle";
import { api } from "../services/api";
import { shareLocationOnWhatsApp } from "../services/locationShare";
import { useDataStore } from "../state/dataStore";
import { theme } from "../theme/theme";

type RideHistorySummary = {
  userId: string;
  totalDistanceKm: number;
  totalDurationSec: number;
  rideCount: number;
  rewardPoints: number;
  rewardRemainderKm: number;
  rewardRule: string;
};

type RidePoint = {
  lat: number;
  lng: number;
  speed?: number;
  altitude?: number;
  ts: string;
};

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function calcDistance(points: RidePoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += haversineKm(points[i - 1], points[i]);
  }
  return Number(total.toFixed(3));
}

export const RideTrackerScreen = () => {
  const rideDraft = useDataStore((s) => s.rideDraft);
  const pushPoint = useDataStore((s) => s.pushPoint);
  const setActiveRideId = useDataStore((s) => s.setActiveRideId);
  const clearRideDraft = useDataStore((s) => s.clearRideDraft);
  const setRecentRides = useDataStore((s) => s.setRecentRides);
  const recentRides = useDataStore((s) => s.recentRides);

  const [recording, setRecording] = useState(false);
  const [summary, setSummary] = useState<RideHistorySummary | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const safetyShareTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [sharePhone, setSharePhone] = useState("");
  const [safetyModeEnabled, setSafetyModeEnabled] = useState(false);
  const [safetyIntervalMin, setSafetyIntervalMin] = useState("5");

  const currentDistanceKm = useMemo(() => calcDistance(rideDraft.points as RidePoint[]), [rideDraft.points]);

  const loadHistory = async () => {
    try {
      const [rides, history] = await Promise.all([
        api.get<any[]>("/api/rides"),
        api.get<RideHistorySummary>("/api/rides/history/summary"),
      ]);
      setRecentRides(rides);
      setSummary(history);
    } catch {
      // keep cached state when offline
    }
  };

  useEffect(() => {
    loadHistory();
    return () => {
      watchRef.current?.remove();
      watchRef.current = null;
      if (safetyShareTimerRef.current) {
        clearInterval(safetyShareTimerRef.current);
        safetyShareTimerRef.current = null;
      }
    };
  }, []);

  const startRide = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Location permission required");
        return;
      }

      clearRideDraft();
      const location = await Location.getCurrentPositionAsync({});
      const firstPoint: RidePoint = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        speed: location.coords.speed ?? 0,
        altitude: location.coords.altitude ?? 0,
        ts: new Date().toISOString(),
      };

      pushPoint(firstPoint);
      const ride = await api.post<any>("/api/rides/start", { points: [firstPoint] });
      setActiveRideId(ride.id);

      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 20,
        },
        (update) => {
          pushPoint({
            lat: update.coords.latitude,
            lng: update.coords.longitude,
            speed: update.coords.speed ?? 0,
            altitude: update.coords.altitude ?? 0,
            ts: new Date().toISOString(),
          });
        },
      );

      setRecording(true);
    } catch (error) {
      Alert.alert("Could not start ride", String(error));
    }
  };

  const stopRide = async () => {
    if (!rideDraft.activeRideId) return;
    try {
      watchRef.current?.remove();
      watchRef.current = null;
      if (safetyShareTimerRef.current) {
        clearInterval(safetyShareTimerRef.current);
        safetyShareTimerRef.current = null;
      }

      const result = await api.post<any>(`/api/rides/${rideDraft.activeRideId}/stop`, {
        points: rideDraft.points,
      });

      clearRideDraft();
      setRecording(false);
      await loadHistory();

      Alert.alert(
        "Ride saved",
        `Distance: ${result.distanceKm.toFixed(2)} km\nReward earned: ${result.rewardEarned ?? 0} points\nBalance: ${result.newRewardBalance ?? 0}`,
      );
    } catch (error) {
      Alert.alert("Could not stop ride", String(error));
    }
  };

  const shareLiveLocation = async (label?: string) => {
    try {
      let latitude = rideDraft.points[rideDraft.points.length - 1]?.lat;
      let longitude = rideDraft.points[rideDraft.points.length - 1]?.lng;

      if (latitude == null || longitude == null) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          Alert.alert("Location permission required");
          return;
        }
        const current = await Location.getCurrentPositionAsync({});
        latitude = current.coords.latitude;
        longitude = current.coords.longitude;
      }

      await shareLocationOnWhatsApp({
        latitude,
        longitude,
        label: label ?? (recording ? "My live ride location (Rideforge)" : "My current location (Rideforge)"),
        phone: sharePhone,
      });
    } catch (error) {
      Alert.alert("Could not share location", String(error));
    }
  };

  useEffect(() => {
    if (!recording) return;

    if (safetyModeEnabled) {
      const intervalMs = Math.max(Number(safetyIntervalMin) || 5, 1) * 60 * 1000;
      if (safetyShareTimerRef.current) clearInterval(safetyShareTimerRef.current);
      safetyShareTimerRef.current = setInterval(() => {
        shareLiveLocation("Automatic safety check-in (Rideforge)").catch(() => undefined);
      }, intervalMs);
    } else if (safetyShareTimerRef.current) {
      clearInterval(safetyShareTimerRef.current);
      safetyShareTimerRef.current = null;
    }

    return () => {
      if (safetyShareTimerRef.current) {
        clearInterval(safetyShareTimerRef.current);
        safetyShareTimerRef.current = null;
      }
    };
  }, [recording, safetyModeEnabled, safetyIntervalMin, sharePhone]);

  const region = {
    latitude: rideDraft.points[0]?.lat ?? 37.7749,
    longitude: rideDraft.points[0]?.lng ?? -122.4194,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  };

  return (
    <Screen>
      <ScreenTitle title="Live Ride Tracker" subtitle="GPS-based tracking with distance history and reward progression." />
      <MapView style={styles.map} initialRegion={region}>
        {rideDraft.points.length > 0 && (
          <Polyline
            coordinates={rideDraft.points.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
            strokeColor={theme.colors.brand.accent}
            strokeWidth={4}
          />
        )}
        {rideDraft.points.slice(-1).map((p) => (
          <Marker key={p.ts} coordinate={{ latitude: p.lat, longitude: p.lng }} />
        ))}
      </MapView>

      <SurfaceCard style={styles.panel}>
        <AppInput
          value={sharePhone}
          onChangeText={setSharePhone}
          placeholder="WhatsApp number (optional, e.g. +9198xxxxxx)"
          keyboardType="phone-pad"
        />
        <View style={styles.row}>
          <AppButton
            label={safetyModeEnabled ? "Safety Mode: ON" : "Safety Mode: OFF"}
            variant={safetyModeEnabled ? "primary" : "secondary"}
            onPress={() => setSafetyModeEnabled((v) => !v)}
            style={styles.flexBtn}
          />
          <AppInput
            value={safetyIntervalMin}
            onChangeText={setSafetyIntervalMin}
            placeholder="Min"
            keyboardType="number-pad"
            style={styles.intervalInput}
          />
        </View>
        <View style={styles.row}>
          <AppButton label="Start Ride" onPress={startRide} disabled={recording} style={styles.flexBtn} />
          <AppButton label="Stop Ride" onPress={stopRide} disabled={!recording} variant="secondary" style={styles.flexBtn} />
        </View>
        <AppButton label="Share Live Location to WhatsApp" onPress={shareLiveLocation} />
        <Text style={styles.stats}>Live distance: {currentDistanceKm.toFixed(2)} km</Text>
        <Text style={styles.stats}>Captured points: {rideDraft.points.length}</Text>
        <Text style={styles.stats}>
          Safety mode: {safetyModeEnabled ? `Enabled (${Math.max(Number(safetyIntervalMin) || 5, 1)} min interval)` : "Disabled"}
        </Text>
        {summary ? (
          <>
            <Text style={styles.stats}>Total history: {summary.totalDistanceKm.toFixed(2)} km ({summary.rideCount} rides)</Text>
            <Text style={styles.stats}>
              Rewards: {summary.rewardPoints} pts | Progress to next point: {summary.rewardRemainderKm.toFixed(2)}/100 km
            </Text>
          </>
        ) : null}
      </SurfaceCard>

      <Text style={styles.sectionTitle}>Recent Ride History</Text>
      <FlatList
        data={recentRides.slice(0, 8)}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SurfaceCard style={styles.historyCard}>
            <Text style={styles.historyTitle}>{new Date(item.startedAt).toLocaleString()}</Text>
            <Text style={styles.stats}>{item.distanceKm.toFixed(2)} km | Avg {item.avgSpeedKmh.toFixed(1)} km/h</Text>
          </SurfaceCard>
        )}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  map: { height: 260, borderRadius: theme.radius.lg, overflow: "hidden", borderWidth: 1, borderColor: theme.colors.border },
  panel: { marginTop: theme.spacing.sm },
  row: { flexDirection: "row", gap: theme.spacing.sm },
  flexBtn: { flex: 1 },
  intervalInput: { width: 84, marginBottom: 0 },
  stats: { color: theme.colors.text.secondary, marginTop: 4, fontSize: 13 },
  sectionTitle: { color: theme.colors.brand.highlight, fontWeight: "800", marginTop: theme.spacing.md, marginBottom: 6 },
  historyCard: { marginBottom: theme.spacing.xs },
  historyTitle: { color: theme.colors.text.primary, fontWeight: "700" },
});
