import React, { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { ScreenTitle } from "../components/ScreenTitle";
import { SurfaceCard } from "../components/SurfaceCard";
import { api } from "../services/api";
import { useAuthStore } from "../state/authStore";
import { theme } from "../theme/theme";

type RideEventItem = {
  id: string;
  hostId: string;
  kind: "ride" | "event";
  title: string;
  description?: string;
  startAt: string;
  locationName: string;
  lat: number;
  lng: number;
  attendeeIds: string[];
};

export const EventsScreen = () => {
  const [items, setItems] = useState<RideEventItem[]>([]);
  const [kind, setKind] = useState<"ride" | "event">("ride");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationName, setLocationName] = useState("");
  const [startAt, setStartAt] = useState("");
  const [lat, setLat] = useState("37.7749");
  const [lng, setLng] = useState("-122.4194");
  const [contactMessage, setContactMessage] = useState("Hi, I am interested in joining. Can you share more details?");
  const user = useAuthStore((s) => s.user);

  const myUserId = user?.id ?? "";

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [items],
  );

  const refresh = async () => {
    try {
      const data = await api.get<RideEventItem[]>("/api/events");
      setItems(data);
    } catch (error) {
      Alert.alert("Could not load rides/events", String(error));
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const create = async () => {
    try {
      await api.post("/api/events", {
        kind,
        title,
        description: description || undefined,
        startAt: startAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        locationName: locationName || "Rider meetup point",
        lat: Number(lat),
        lng: Number(lng),
      });
      setTitle("");
      setDescription("");
      setLocationName("");
      setStartAt("");
      await refresh();
    } catch (error) {
      Alert.alert("Could not create listing", String(error));
    }
  };

  const expressInterest = async (id: string) => {
    try {
      await api.post(`/api/events/${id}/interest`, {});
      await refresh();
      Alert.alert("Interest submitted", "You are now marked as interested.");
    } catch (error) {
      Alert.alert("Could not submit interest", String(error));
    }
  };

  const contactCreator = async (id: string, hostId: string) => {
    if (!contactMessage.trim()) {
      Alert.alert("Please enter a message first");
      return;
    }

    if (hostId === myUserId) {
      Alert.alert("This is your own listing");
      return;
    }

    try {
      const result = await api.post<{ conversationId: string }>(`/api/events/${id}/contact`, {
        message: contactMessage.trim(),
      });
      Alert.alert("Message sent", `Conversation created. Open Chat tab and find conversation ${result.conversationId.slice(0, 8)}.`);
    } catch (error) {
      Alert.alert("Could not contact creator", String(error));
    }
  };

  return (
    <Screen>
      <ScreenTitle
        title="Ride & Events"
        subtitle="Post rides and biking events, join listings, and coordinate with creators in chat."
      />

      <SurfaceCard>
        <View style={styles.kindRow}>
          <AppButton
            label="Post Ride"
            onPress={() => setKind("ride")}
            variant={kind === "ride" ? "primary" : "secondary"}
            style={styles.kindBtn}
          />
          <AppButton
            label="Post Event"
            onPress={() => setKind("event")}
            variant={kind === "event" ? "primary" : "secondary"}
            style={styles.kindBtn}
          />
        </View>
        <AppInput value={title} onChangeText={setTitle} placeholder={`${kind === "ride" ? "Ride" : "Event"} title`} />
        <AppInput value={description} onChangeText={setDescription} placeholder="Description (route plan, requirements, notes)" />
        <AppInput value={startAt} onChangeText={setStartAt} placeholder="Start date/time ISO (optional)" />
        <AppInput value={locationName} onChangeText={setLocationName} placeholder="Location name" />
        <View style={styles.row}>
          <AppInput value={lat} onChangeText={setLat} placeholder="Lat" keyboardType="numeric" style={styles.halfInput} />
          <AppInput value={lng} onChangeText={setLng} placeholder="Lng" keyboardType="numeric" style={styles.halfInput} />
        </View>
        <AppButton label="Publish Listing" onPress={create} disabled={!title.trim()} />
        <AppButton label="Refresh Listings" variant="secondary" onPress={refresh} />
      </SurfaceCard>

      <SurfaceCard style={styles.contactBox}>
        <Text style={styles.contactLabel}>Default message to creators</Text>
        <AppInput value={contactMessage} onChangeText={setContactMessage} placeholder="Type your question/request to join" />
      </SurfaceCard>

      <FlatList
        data={sortedItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const alreadyInterested = item.attendeeIds.includes(myUserId);
          const mine = item.hostId === myUserId;
          return (
            <SurfaceCard style={styles.card}>
              <Text style={styles.badge}>{item.kind === "ride" ? "RIDE" : "EVENT"}</Text>
              <Text style={styles.main}>{item.title}</Text>
              <Text style={styles.meta}>{item.description || "No description"}</Text>
              <Text style={styles.meta}>Date: {new Date(item.startAt).toLocaleString()}</Text>
              <Text style={styles.meta}>Location: {item.locationName}</Text>
              <Text style={styles.meta}>Interested riders: {item.attendeeIds.length}</Text>

              <View style={styles.actionRow}>
                <AppButton
                  label={alreadyInterested ? "Interested" : "I'm Interested"}
                  onPress={() => expressInterest(item.id)}
                  disabled={alreadyInterested}
                  variant={alreadyInterested ? "secondary" : "primary"}
                  style={styles.actionBtn}
                />
                <AppButton
                  label={mine ? "Your Listing" : "Contact Creator"}
                  onPress={() => contactCreator(item.id, item.hostId)}
                  disabled={mine}
                  variant="secondary"
                  style={styles.actionBtn}
                />
              </View>
            </SurfaceCard>
          );
        }}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  kindRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  kindBtn: {
    flex: 1,
  },
  halfInput: {
    flex: 1,
  },
  contactBox: {
    marginTop: theme.spacing.sm,
  },
  contactLabel: {
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
    fontWeight: "700",
  },
  card: {
    marginTop: theme.spacing.sm,
  },
  badge: {
    color: theme.colors.brand.highlight,
    fontWeight: "900",
    marginBottom: 4,
  },
  main: {
    color: theme.colors.text.primary,
    fontWeight: "800",
    fontSize: 17,
  },
  meta: {
    color: theme.colors.text.secondary,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
});
