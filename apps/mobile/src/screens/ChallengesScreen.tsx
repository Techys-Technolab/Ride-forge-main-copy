import React, { useEffect, useState } from "react";
import { Alert, FlatList, StyleSheet, Text } from "react-native";
import { Screen } from "../components/Screen";
import { AppButton } from "../components/AppButton";
import { ScreenTitle } from "../components/ScreenTitle";
import { SurfaceCard } from "../components/SurfaceCard";
import { api } from "../services/api";
import { theme } from "../theme/theme";

type Challenge = {
  id: string;
  title: string;
  description: string;
  rewardPoints: number;
  dynamicSignal: string;
  endsAt: string;
};

type RewardTransaction = {
  id: string;
  pointsDelta: number;
  reason: string;
  createdAt: string;
};

export const ChallengesScreen = () => {
  const [rewardBalance, setRewardBalance] = useState(0);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [transactions, setTransactions] = useState<RewardTransaction[]>([]);

  const refresh = async () => {
    try {
      const [challengeData, transactionData] = await Promise.all([
        api.get<{ rewardBalance: number; challenges: Challenge[] }>("/api/challenges"),
        api.get<RewardTransaction[]>("/api/rewards/transactions"),
      ]);

      setRewardBalance(challengeData.rewardBalance);
      setChallenges(challengeData.challenges);
      setTransactions(transactionData);
    } catch (error) {
      Alert.alert("Challenges load failed", String(error));
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const completeChallenge = async (challengeId: string) => {
    try {
      await api.post(`/api/challenges/${challengeId}/complete`, {});
      await refresh();
    } catch (error) {
      Alert.alert("Could not complete challenge", String(error));
    }
  };

  return (
    <Screen>
      <ScreenTitle title="Challenges & Rewards" subtitle="Complete live rider challenges and stack reward points." />
      <SurfaceCard style={styles.hero}>
        <Text style={styles.balanceLabel}>Current Balance</Text>
        <Text style={styles.balance}>{rewardBalance} pts</Text>
      </SurfaceCard>

      <Text style={styles.section}>Available Challenges</Text>
      <FlatList
        data={challenges}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SurfaceCard style={styles.challengeCard}>
            <Text style={styles.challengeTitle}>{item.title}</Text>
            <Text style={styles.challengeDesc}>{item.description}</Text>
            <Text style={styles.challengeMeta}>Signal: {item.dynamicSignal}</Text>
            <Text style={styles.challengeMeta}>Reward: {item.rewardPoints} pts</Text>
            <Text style={styles.challengeMeta}>Ends: {new Date(item.endsAt).toLocaleString()}</Text>
            <AppButton label="Mark as Completed" onPress={() => completeChallenge(item.id)} />
          </SurfaceCard>
        )}
      />

      <Text style={styles.section}>Rewards Ledger</Text>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SurfaceCard style={styles.txCard}>
            <Text style={styles.txText}>{item.reason}</Text>
            <Text style={styles.txText}>{item.pointsDelta > 0 ? `+${item.pointsDelta}` : item.pointsDelta} pts</Text>
            <Text style={styles.txMeta}>{new Date(item.createdAt).toLocaleString()}</Text>
          </SurfaceCard>
        )}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  hero: {
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.background.elevated,
  },
  balanceLabel: {
    color: theme.colors.text.secondary,
    fontWeight: "700",
  },
  balance: { color: theme.colors.brand.highlight, fontSize: 30, fontWeight: "900", marginTop: 4 },
  section: { color: theme.colors.brand.primary, fontWeight: "800", marginBottom: 8 },
  challengeCard: { marginBottom: theme.spacing.sm },
  challengeTitle: { color: theme.colors.text.primary, fontWeight: "800" },
  challengeDesc: { color: theme.colors.text.secondary, marginVertical: 4 },
  challengeMeta: { color: theme.colors.text.muted, fontSize: 13 },
  txCard: { marginBottom: theme.spacing.xs },
  txText: { color: theme.colors.text.primary },
  txMeta: { color: theme.colors.text.muted, fontSize: 13 },
});
