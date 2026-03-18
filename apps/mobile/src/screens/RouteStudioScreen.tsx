import React, { useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { SurfaceCard } from "../components/SurfaceCard";
import { ScreenTitle } from "../components/ScreenTitle";
import { api } from "../services/api";
import { useDataStore } from "../state/dataStore";
import { theme } from "../theme/theme";

export const RouteStudioScreen = () => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const savedRoutes = useDataStore((s) => s.savedRoutes);
  const setSavedRoutes = useDataStore((s) => s.setSavedRoutes);

  const loadRoutes = async () => {
    const routes = await api.get<any[]>("/api/routes");
    setSavedRoutes(routes);
  };

  const createRoute = async () => {
    try {
      await api.post("/api/routes", {
        name,
        description,
        isPublic: true,
        tags: ["scenic"],
        waypoints: [
          { name: "Start", lat: 37.7749, lng: -122.4194 },
          { name: "Waypoint", lat: 37.8044, lng: -122.2712, hazard: "Sharp turn" },
          { name: "Finish", lat: 37.8715, lng: -122.273 },
        ],
      });
      setName("");
      setDescription("");
      await loadRoutes();
      Alert.alert("Route created");
    } catch (error) {
      Alert.alert("Error", String(error));
    }
  };

  return (
    <Screen>
      <ScreenTitle title="Route Studio" subtitle="Build and save scenic routes with rider-friendly waypoints." />
      <SurfaceCard style={styles.form}>
        <AppInput value={name} onChangeText={setName} placeholder="Route name" />
        <AppInput value={description} onChangeText={setDescription} placeholder="Description" />
        <AppButton label="Create Route" onPress={createRoute} disabled={!name} />
        <AppButton label="Refresh Routes" variant="secondary" onPress={loadRoutes} />
      </SurfaceCard>

      <FlatList
        style={{ marginTop: theme.spacing.md }}
        data={savedRoutes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SurfaceCard style={styles.card}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardText}>{item.waypoints.length} waypoints</Text>
          </SurfaceCard>
        )}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  form: {
    marginBottom: theme.spacing.sm,
  },
  card: {
    marginBottom: theme.spacing.sm,
  },
  cardTitle: { color: theme.colors.text.primary, fontWeight: "700" },
  cardText: { color: theme.colors.text.secondary },
});
