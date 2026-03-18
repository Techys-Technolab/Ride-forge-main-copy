import React, { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Screen } from "../components/Screen";
import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { ScreenTitle } from "../components/ScreenTitle";
import { SurfaceCard } from "../components/SurfaceCard";
import { api } from "../services/api";
import { getSocket } from "../services/socket";
import { theme } from "../theme/theme";

type Conversation = { id: string; type: string; name?: string; memberIds: string[]; lastMessage?: string };
type Message = { id: string; conversationId: string; senderId: string; content: string; createdAt: string };
type HelpRequest = {
  id: string;
  requesterId: string;
  destinationCity: string;
  destinationState: string;
  message: string;
  status: string;
};
type Rider = { id: string; displayName: string; city?: string; state?: string };

export const ChatScreen = () => {
  const { width } = useWindowDimensions();
  const isNarrow = width < 900;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");

  const [riderQuery, setRiderQuery] = useState("");
  const [riderResults, setRiderResults] = useState<Rider[]>([]);
  const [selectedPeerUserId, setSelectedPeerUserId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>([]);

  const [destinationCity, setDestinationCity] = useState("");
  const [destinationState, setDestinationState] = useState("");
  const [helpText, setHelpText] = useState("");
  const [openHelpRequests, setOpenHelpRequests] = useState<HelpRequest[]>([]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId),
    [conversations, activeConversationId],
  );

  const loadConversations = async () => {
    try {
      const data = await api.get<Conversation[]>("/api/chat/conversations");
      setConversations(data);
      if (!activeConversationId && data.length > 0) {
        setActiveConversationId(data[0].id);
      }
    } catch (error) {
      Alert.alert("Chat load failed", String(error));
    }
  };

  const searchRiders = async () => {
    try {
      const q = riderQuery.trim();
      const data = await api.get<Rider[]>(`/api/chat/riders${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      setRiderResults(data);
    } catch {
      setRiderResults([]);
    }
  };

  const toggleGroupMember = (userId: string) => {
    setGroupMembers((previous) =>
      previous.includes(userId) ? previous.filter((id) => id !== userId) : [...previous, userId],
    );
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const data = await api.get<Message[]>(`/api/chat/conversations/${conversationId}/messages`);
      setMessages(data);
      getSocket().emit("chat:join", conversationId);
    } catch (error) {
      Alert.alert("Messages load failed", String(error));
    }
  };

  const loadHelpRequests = async () => {
    try {
      const data = await api.get<HelpRequest[]>("/api/chat/help-requests/open");
      setOpenHelpRequests(data);
    } catch {
      setOpenHelpRequests([]);
    }
  };

  useEffect(() => {
    loadConversations();
    loadHelpRequests();
    searchRiders();

    const socket = getSocket();
    const handler = (incoming: Message) => {
      if (incoming.conversationId === activeConversationId) {
        setMessages((previous) => [...previous, incoming]);
      }
      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id === incoming.conversationId ? { ...conversation, lastMessage: incoming.content } : conversation,
        ),
      );
    };

    socket.on("chat:message:new", handler);
    return () => socket.off("chat:message:new", handler);
  }, [activeConversationId]);

  useEffect(() => {
    if (activeConversationId) loadMessages(activeConversationId);
  }, [activeConversationId]);

  const startPersonalChat = async () => {
    try {
      const data = await api.post<{ id: string }>("/api/chat/conversations/personal", { peerUserId: selectedPeerUserId });
      setSelectedPeerUserId("");
      await loadConversations();
      setActiveConversationId(data.id);
    } catch (error) {
      Alert.alert("Unable to create personal chat", String(error));
    }
  };

  const createGroup = async () => {
    try {
      await api.post("/api/chat/conversations/group", { name: groupName, memberIds: groupMembers });
      setGroupName("");
      setGroupMembers([]);
      await loadConversations();
    } catch (error) {
      Alert.alert("Unable to create group", String(error));
    }
  };

  const sendMessage = async () => {
    if (!activeConversationId || !draft.trim()) return;
    try {
      await api.post(`/api/chat/conversations/${activeConversationId}/messages`, { content: draft.trim() });
      setDraft("");
    } catch (error) {
      Alert.alert("Could not send message", String(error));
    }
  };

  const askForLocalHelp = async () => {
    try {
      await api.post("/api/chat/help-requests", { destinationCity, destinationState, message: helpText });
      setDestinationCity("");
      setDestinationState("");
      setHelpText("");
      await loadHelpRequests();
      Alert.alert("Help request published", "Nearby riders can now reach you.");
    } catch (error) {
      Alert.alert("Could not publish help request", String(error));
    }
  };

  const respondToHelp = async (helpRequestId: string) => {
    try {
      const data = await api.post<{ conversationId: string }>(`/api/chat/help-requests/${helpRequestId}/respond`);
      await loadConversations();
      setActiveConversationId(data.conversationId);
      await loadHelpRequests();
    } catch (error) {
      Alert.alert("Could not respond", String(error));
    }
  };

  return (
    <Screen>
      <ScreenTitle title="Rider Comms Hub" subtitle="Personal chats, group channels, and local rider help." />

      <SurfaceCard style={styles.block}>
        <AppInput value={riderQuery} onChangeText={setRiderQuery} placeholder="Search riders by name" />
        <AppButton label="Search Riders" variant="secondary" onPress={searchRiders} />
        <ScrollView horizontal style={styles.riderScroll} showsHorizontalScrollIndicator={false}>
          {riderResults.map((rider) => (
            <Pressable
              key={rider.id}
              onPress={() => setSelectedPeerUserId(rider.id)}
              style={[styles.riderCard, selectedPeerUserId === rider.id && styles.riderCardActive]}
              accessibilityRole="button"
              accessibilityLabel={`Select rider ${rider.displayName}`}
            >
              <Text style={styles.convTitle}>{rider.displayName}</Text>
              <Text style={styles.convMeta}>{rider.city && rider.state ? `${rider.city}, ${rider.state}` : "Rider"}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <AppButton label="Start Personal Chat" onPress={startPersonalChat} disabled={!selectedPeerUserId} />

        <AppInput value={groupName} onChangeText={setGroupName} placeholder="Group name" />
        <Text style={styles.convMeta}>Tap riders above to add/remove group members</Text>
        <ScrollView horizontal style={styles.riderScroll} showsHorizontalScrollIndicator={false}>
          {riderResults.map((rider) => (
            <Pressable
              key={`group-${rider.id}`}
              onPress={() => toggleGroupMember(rider.id)}
              style={[styles.riderCard, groupMembers.includes(rider.id) && styles.riderCardActive]}
              accessibilityRole="button"
              accessibilityLabel={`Toggle group member ${rider.displayName}`}
            >
              <Text style={styles.convTitle}>{rider.displayName}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <AppButton label="Create Group Chat" onPress={createGroup} disabled={!groupName || groupMembers.length === 0} />
      </SurfaceCard>

      <View style={[styles.chatLayout, isNarrow && styles.chatLayoutNarrow]}>
        <SurfaceCard style={[styles.sidebar, isNarrow && styles.fullWidthCard]}>
          <Text style={styles.section}>Conversations</Text>
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setActiveConversationId(item.id)}
                style={[styles.convCard, activeConversationId === item.id && styles.convCardActive]}
                accessibilityRole="button"
                accessibilityLabel={`Open conversation ${item.name ?? item.type}`}
              >
                <Text style={styles.convTitle}>{item.name ?? `${item.type.toUpperCase()} chat`}</Text>
                <Text style={styles.convMeta}>{item.lastMessage ?? "No messages yet"}</Text>
              </Pressable>
            )}
          />
        </SurfaceCard>

        <SurfaceCard style={[styles.messagesPane, isNarrow && styles.fullWidthCard]}>
          <Text style={styles.section}>{activeConversation ? activeConversation.name ?? "Conversation" : "Select a conversation"}</Text>
          <ScrollView style={styles.messageList}>
            {messages.map((message) => (
              <View key={message.id} style={styles.messageBubble}>
                <Text style={styles.messageText}>{message.content}</Text>
                <Text style={styles.messageMeta}>{new Date(message.createdAt).toLocaleTimeString()}</Text>
              </View>
            ))}
          </ScrollView>
          <AppInput value={draft} onChangeText={setDraft} placeholder="Type message" />
          <AppButton label="Send" onPress={sendMessage} disabled={!activeConversationId || !draft.trim()} />
        </SurfaceCard>
      </View>

      <SurfaceCard style={styles.helpPanel}>
        <Text style={styles.section}>Traveling Rider Help</Text>
        <AppInput value={destinationCity} onChangeText={setDestinationCity} placeholder="Destination city" />
        <AppInput value={destinationState} onChangeText={setDestinationState} placeholder="Destination state" />
        <AppInput value={helpText} onChangeText={setHelpText} placeholder="What help do you need?" />
        <AppButton label="Request Help" onPress={askForLocalHelp} disabled={!destinationCity || !destinationState || !helpText} />

        <Text style={[styles.section, { marginTop: theme.spacing.md }]}>Open Local Requests</Text>
        {openHelpRequests.map((request) => (
          <View key={request.id} style={styles.helpCard}>
            <Text style={styles.helpTitle}>
              {request.destinationCity}, {request.destinationState}
            </Text>
            <Text style={styles.convMeta}>{request.message}</Text>
            <AppButton label="Respond & Open Chat" variant="secondary" onPress={() => respondToHelp(request.id)} />
          </View>
        ))}
      </SurfaceCard>
    </Screen>
  );
};

const styles = StyleSheet.create({
  block: { marginBottom: theme.spacing.md },
  riderScroll: { marginBottom: theme.spacing.sm },
  riderCard: {
    padding: theme.spacing.sm,
    minHeight: 46,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    marginRight: theme.spacing.sm,
    minWidth: 120,
    backgroundColor: theme.colors.background.tertiary,
  },
  riderCardActive: { borderColor: theme.colors.brand.primary },
  chatLayout: { flexDirection: "row", gap: theme.spacing.sm },
  chatLayoutNarrow: { flexDirection: "column" },
  fullWidthCard: { width: "100%" },
  sidebar: { flex: 1, minHeight: 240 },
  messagesPane: { flex: 1.2, minHeight: 300 },
  section: { color: theme.colors.brand.highlight, fontWeight: "800", marginBottom: theme.spacing.sm },
  convCard: {
    padding: theme.spacing.sm,
    minHeight: 46,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background.tertiary,
  },
  convCardActive: { borderColor: theme.colors.brand.primary },
  convTitle: { color: theme.colors.text.primary, fontWeight: "700" },
  convMeta: { color: theme.colors.text.secondary, fontSize: 13 },
  messageList: { flex: 1, marginBottom: theme.spacing.sm, maxHeight: 200 },
  messageBubble: {
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  messageText: { color: theme.colors.text.primary },
  messageMeta: { color: theme.colors.text.muted, fontSize: 13, marginTop: 2 },
  helpPanel: { marginTop: theme.spacing.md, marginBottom: theme.spacing.md },
  helpCard: {
    marginTop: theme.spacing.sm,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.background.tertiary,
  },
  helpTitle: { color: theme.colors.text.primary, fontWeight: "700" },
});
