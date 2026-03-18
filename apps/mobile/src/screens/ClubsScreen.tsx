import React, { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { AppInput } from "../components/AppInput";
import { AppButton } from "../components/AppButton";
import { ScreenTitle } from "../components/ScreenTitle";
import { SurfaceCard } from "../components/SurfaceCard";
import { api } from "../services/api";
import { useAuthStore } from "../state/authStore";
import { theme } from "../theme/theme";

type Club = {
  id: string;
  clubCode: string;
  clubName: string;
  adminName: string;
  about: string;
  city: string;
  state: string;
  country: string;
  memberCount: number;
  activityCount: number;
  joinStatus?: "pending" | "approved" | "rejected";
};

export const ClubsScreen = () => {
  const user = useAuthStore((s) => s.user);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"popularity" | "activity" | "newest">("popularity");
  const isAdmin = useMemo(() => user?.accountType === "club" || user?.role === "club_admin", [user?.accountType, user?.role]);

  const load = async () => {
    try {
      const [clubsData, requestsData] = await Promise.all([
        api.get<Club[]>(`/api/clubs?q=${encodeURIComponent(query)}&sort=${sort}`),
        isAdmin ? api.get<any[]>("/api/clubs/my/requests") : Promise.resolve([]),
      ]);
      setClubs(clubsData);
      setPending(requestsData);
    } catch (error) {
      Alert.alert("Clubs", String(error));
    }
  };

  useEffect(() => {
    load();
  }, [sort]);

  const sendJoin = async (clubId: string) => {
    try {
      await api.post(`/api/clubs/${clubId}/join`);
      await load();
    } catch (error) {
      Alert.alert("Join request", String(error));
    }
  };

  const cancelJoin = async (clubId: string) => {
    try {
      await api.post(`/api/clubs/${clubId}/cancel`);
      await load();
    } catch (error) {
      Alert.alert("Cancel request", String(error));
    }
  };

  const reviewRequest = async (clubId: string, userId: string, approve: boolean) => {
    try {
      await api.post(`/api/clubs/${clubId}/review`, { userId, approve });
      await load();
    } catch (error) {
      Alert.alert("Review request", String(error));
    }
  };

  return (
    <Screen>
      <ScreenTitle title="Clubs" subtitle="Discover clubs, request membership, and manage join approvals." />
      <SurfaceCard style={styles.filterCard}>
        <AppInput value={query} onChangeText={setQuery} placeholder="Search clubs..." />
        <View style={styles.sortRow}>
          <AppButton label="Popularity" variant={sort === "popularity" ? "primary" : "secondary"} onPress={() => setSort("popularity")} />
          <AppButton label="Activity" variant={sort === "activity" ? "primary" : "secondary"} onPress={() => setSort("activity")} />
          <AppButton label="Newest" variant={sort === "newest" ? "primary" : "secondary"} onPress={() => setSort("newest")} />
        </View>
        <AppButton label="Apply Search" onPress={load} />
      </SurfaceCard>

      {isAdmin && pending.length > 0 ? (
        <SurfaceCard>
          <Text style={styles.sectionTitle}>Pending Join Requests</Text>
          {pending.map((request) => (
            <View key={request.id} style={styles.requestRow}>
              <Text style={styles.requestText}>
                {request.displayName} ({request.email}) -> {request.clubName}
              </Text>
              <View style={styles.actionRow}>
                <AppButton label="Approve" onPress={() => reviewRequest(request.clubId, request.userId, true)} />
                <AppButton label="Reject" variant="secondary" onPress={() => reviewRequest(request.clubId, request.userId, false)} />
              </View>
            </View>
          ))}
        </SurfaceCard>
      ) : null}

      <FlatList
        data={clubs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <SurfaceCard style={styles.clubCard}>
            <Text style={styles.clubName}>{item.clubName}</Text>
            <Text style={styles.meta}>{item.clubCode}</Text>
            <Text style={styles.meta}>
              {item.city}, {item.state}, {item.country}
            </Text>
            <Text style={styles.meta}>Admin: {item.adminName}</Text>
            <Text style={styles.description}>{item.about}</Text>
            <Text style={styles.meta}>
              Members: {item.memberCount} | Activity: {item.activityCount}
            </Text>
            {user?.accountType === "rider" ? (
              item.joinStatus === "pending" ? (
                <AppButton label="Cancel Pending Request" variant="secondary" onPress={() => cancelJoin(item.id)} />
              ) : item.joinStatus === "approved" ? (
                <Text style={styles.approved}>You are a member of this club.</Text>
              ) : (
                <AppButton label="Join Club" onPress={() => sendJoin(item.id)} />
              )
            ) : null}
          </SurfaceCard>
        )}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  filterCard: {
    marginBottom: theme.spacing.sm,
  },
  sortRow: {
    marginBottom: theme.spacing.sm,
  },
  list: {
    paddingBottom: 120,
  },
  clubCard: {
    marginBottom: theme.spacing.sm,
  },
  clubName: {
    color: theme.colors.text.primary,
    fontWeight: "800",
    fontSize: 18,
  },
  meta: {
    color: theme.colors.text.secondary,
    fontSize: 13,
    marginTop: 2,
  },
  description: {
    color: theme.colors.text.primary,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  approved: {
    color: theme.colors.success,
    fontWeight: "700",
    marginTop: theme.spacing.xs,
  },
  sectionTitle: {
    color: theme.colors.text.primary,
    fontWeight: "800",
    marginBottom: theme.spacing.sm,
    fontSize: 16,
  },
  requestRow: {
    marginBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: theme.spacing.sm,
  },
  requestText: {
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  actionRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
});
