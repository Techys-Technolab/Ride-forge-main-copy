import React, { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, StyleSheet, Switch, Text, View } from "react-native";
import MapView, { Polygon, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Screen } from "../components/Screen";
import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { SurfaceCard } from "../components/SurfaceCard";
import { ScreenTitle } from "../components/ScreenTitle";
import { api } from "../services/api";
import { shareLocationOnWhatsApp } from "../services/locationShare";
import { useDataStore } from "../state/dataStore";
import { theme } from "../theme/theme";

type OfflinePack = {
  id: string;
  name: string;
  bounds: { minLat: number; minLng: number; maxLat: number; maxLng: number };
  tileCountEstimate: number;
  createdAt: string;
};

type TileManifest = {
  provider: string;
  online: boolean;
  region: { lat: number; lng: number };
  offlineHints: string[];
};

export const MapHubScreen = () => {
  const [onlineMode, setOnlineMode] = useState(true);
  const [packs, setPacks] = useState<OfflinePack[]>([]);
  const [packName, setPackName] = useState("Weekend Loop");
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [manifest, setManifest] = useState<TileManifest | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [sharePhone, setSharePhone] = useState("");
  const recentRides = useDataStore((s) => s.recentRides);
  const setRecentRides = useDataStore((s) => s.setRecentRides);

  const hydrateCachedPacks = async () => {
    try {
      const raw = await AsyncStorage.getItem("rideforge-offline-packs");
      if (!raw) return;
      const cached = JSON.parse(raw) as { packs: OfflinePack[]; selectedPackId: string | null };
      setPacks(cached.packs ?? []);
      setSelectedPackId(cached.selectedPackId ?? null);
    } catch {
      // ignore corrupt cache
    }
  };

  const refreshPacks = async () => {
    try {
      const rows = await api.get<OfflinePack[]>("/api/maps/offline-packs");
      setPacks(rows);
      const nextSelected = selectedPackId ?? (rows.length > 0 ? rows[0].id : null);
      setSelectedPackId(nextSelected);
      await AsyncStorage.setItem("rideforge-offline-packs", JSON.stringify({ packs: rows, selectedPackId: nextSelected }));
    } catch {
      // keep cached packs for offline usage
    }
  };

  const loadRides = async () => {
    try {
      const rides = await api.get<any[]>("/api/rides");
      setRecentRides(rides);
    } catch {
      // use cached rides when offline
    }
  };

  const loadLocationAndManifest = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") return;
      const location = await Location.getCurrentPositionAsync({});
      const next = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      setCurrentLocation(next);
      const data = await api.get<TileManifest>(`/api/maps/tile-manifest?lat=${next.latitude}&lng=${next.longitude}`);
      setManifest(data);
    } catch {
      setManifest(null);
    }
  };

  useEffect(() => {
    hydrateCachedPacks();
    refreshPacks();
    loadRides();
    loadLocationAndManifest();
  }, []);

  const selectedPack = packs.find((pack) => pack.id === selectedPackId);

  const recentRideCoordinates = useMemo(() => {
    const points = recentRides[0]?.points ?? [];
    return points.map((point: { lat: number; lng: number }) => ({ latitude: point.lat, longitude: point.lng }));
  }, [recentRides]);

  const createPack = async () => {
    try {
      const lat = currentLocation?.latitude ?? 37.7749;
      const lng = currentLocation?.longitude ?? -122.4194;
      await api.post("/api/maps/offline-packs", {
        name: packName,
        minLat: lat - 0.12,
        minLng: lng - 0.12,
        maxLat: lat + 0.12,
        maxLng: lng + 0.12,
      });
      await refreshPacks();
      Alert.alert("Offline map pack created");
    } catch (error) {
      Alert.alert("Could not create offline pack", String(error));
    }
  };

  const shareCurrentLocation = async () => {
    try {
      let latitude = currentLocation?.latitude;
      let longitude = currentLocation?.longitude;

      if (latitude == null || longitude == null) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          Alert.alert("Location permission required");
          return;
        }
        const location = await Location.getCurrentPositionAsync({});
        latitude = location.coords.latitude;
        longitude = location.coords.longitude;
        setCurrentLocation({ latitude, longitude });
      }

      await shareLocationOnWhatsApp({
        latitude,
        longitude,
        label: onlineMode ? "My current location (Rideforge)" : "My offline route area (Rideforge)",
        phone: sharePhone,
      });
    } catch (error) {
      Alert.alert("Could not share location", String(error));
    }
  };

  const region = {
    latitude: currentLocation?.latitude ?? 37.7749,
    longitude: currentLocation?.longitude ?? -122.4194,
    latitudeDelta: 0.25,
    longitudeDelta: 0.25,
  };

  return (
    <Screen>
      <ScreenTitle title="Maps Hub" subtitle="Online map navigation + offline zone mode with cached ride history." />
      <SurfaceCard style={styles.modeCard}>
        <Text style={styles.modeLabel}>{onlineMode ? "Online map mode" : "Offline pack mode"}</Text>
        <Switch
          value={onlineMode}
          onValueChange={setOnlineMode}
          thumbColor={theme.colors.brand.primary}
          accessibilityLabel="Toggle online and offline map mode"
        />
      </SurfaceCard>

      <MapView
        style={styles.map}
        initialRegion={region}
        mapType={onlineMode ? "standard" : "mutedStandard"}
        showsCompass
        showsUserLocation={onlineMode}
      >
        {!onlineMode && selectedPack && (
          <Polygon
            coordinates={[
              { latitude: selectedPack.bounds.minLat, longitude: selectedPack.bounds.minLng },
              { latitude: selectedPack.bounds.minLat, longitude: selectedPack.bounds.maxLng },
              { latitude: selectedPack.bounds.maxLat, longitude: selectedPack.bounds.maxLng },
              { latitude: selectedPack.bounds.maxLat, longitude: selectedPack.bounds.minLng },
            ]}
            fillColor="rgba(0, 194, 255, 0.18)"
            strokeColor={theme.colors.brand.accent}
            strokeWidth={2}
          />
        )}
        {!onlineMode && recentRideCoordinates.length > 1 && (
          <Polyline coordinates={recentRideCoordinates} strokeColor={theme.colors.brand.highlight} strokeWidth={3} />
        )}
      </MapView>

      <SurfaceCard style={styles.panel}>
        <Text style={styles.panelTitle}>Offline Pack Manager</Text>
        <AppInput value={packName} onChangeText={setPackName} placeholder="Pack name" />
        <AppInput
          value={sharePhone}
          onChangeText={setSharePhone}
          placeholder="WhatsApp number for direct share (optional)"
          keyboardType="phone-pad"
        />
        <AppButton label="Create Offline Pack Around My Location" onPress={createPack} />
        <AppButton label="Refresh Packs" variant="secondary" onPress={refreshPacks} />
        <AppButton label="Refresh Map Manifest" variant="secondary" onPress={loadLocationAndManifest} />
        <AppButton label="Share Location to WhatsApp" onPress={shareCurrentLocation} />

        {manifest?.offlineHints?.length ? (
          <View style={styles.hints}>
            {manifest.offlineHints.map((hint) => (
              <Text key={hint} style={styles.hintText}>• {hint}</Text>
            ))}
          </View>
        ) : null}

        <FlatList
          data={packs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.packCard, selectedPackId === item.id && styles.packCardActive]}>
              <Text style={styles.packTitle}>{item.name}</Text>
              <Text style={styles.packMeta}>Tile estimate: {item.tileCountEstimate}</Text>
              <AppButton
                label="Use Pack Offline"
                variant="secondary"
                onPress={() => {
                  setSelectedPackId(item.id);
                  setOnlineMode(false);
                  AsyncStorage.setItem(
                    "rideforge-offline-packs",
                    JSON.stringify({ packs, selectedPackId: item.id }),
                  ).catch(() => undefined);
                }}
              />
            </View>
          )}
        />
      </SurfaceCard>
    </Screen>
  );
};

const styles = StyleSheet.create({
  modeCard: {
    marginBottom: theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modeLabel: { color: theme.colors.text.secondary, fontWeight: "700" },
  map: {
    height: 240,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    borderColor: theme.colors.border,
    borderWidth: 1,
  },
  panel: { marginTop: theme.spacing.md, flex: 1 },
  panelTitle: { color: theme.colors.brand.highlight, fontWeight: "800", marginBottom: theme.spacing.sm },
  hints: {
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.radius.sm,
    borderColor: theme.colors.border,
    borderWidth: 1,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  hintText: { color: theme.colors.text.secondary, fontSize: 13 },
  packCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background.tertiary,
  },
  packCardActive: { borderColor: theme.colors.brand.primary },
  packTitle: { color: theme.colors.text.primary, fontWeight: "700" },
  packMeta: { color: theme.colors.text.secondary, fontSize: 13 },
});
