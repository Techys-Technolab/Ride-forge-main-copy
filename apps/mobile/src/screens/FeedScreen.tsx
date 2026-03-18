import React, { useState } from "react";
import { Alert, FlatList, StyleSheet, Text } from "react-native";
import { Screen } from "../components/Screen";
import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { ScreenTitle } from "../components/ScreenTitle";
import { SurfaceCard } from "../components/SurfaceCard";
import { api } from "../services/api";
import { theme } from "../theme/theme";

export const FeedScreen = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [caption, setCaption] = useState("");

  const loadFeed = async () => {
    try {
      const data = await api.get<any[]>("/api/social/feed");
      setPosts(data);
    } catch (error) {
      Alert.alert("Failed to load feed", String(error));
    }
  };

  const createPost = async () => {
    try {
      await api.post("/api/social/posts", { caption });
      setCaption("");
      await loadFeed();
    } catch (error) {
      Alert.alert("Failed to create post", String(error));
    }
  };

  return (
    <Screen>
      <ScreenTitle title="Community Feed" subtitle="Share your ride moments with the brotherhood." />
      <SurfaceCard>
        <AppInput value={caption} onChangeText={setCaption} placeholder="Share your ride story" />
        <AppButton label="Post" onPress={createPost} disabled={!caption} />
        <AppButton label="Refresh" variant="secondary" onPress={loadFeed} />
      </SurfaceCard>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SurfaceCard style={styles.card}>
            <Text style={styles.caption}>{item.caption}</Text>
            <Text style={styles.meta}>{new Date(item.createdAt).toLocaleString()}</Text>
          </SurfaceCard>
        )}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: theme.spacing.sm,
  },
  caption: { color: theme.colors.text.primary, fontWeight: "700" },
  meta: { color: theme.colors.text.secondary, marginTop: 6, fontSize: 13 },
});
