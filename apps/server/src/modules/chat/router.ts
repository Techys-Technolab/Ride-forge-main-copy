import { Router } from "express";
import { z } from "zod";
import { authGuard } from "../../middleware/auth";
import { getIoServer } from "../realtime/gateway";
import {
  attachHelpConversation,
  createConversation,
  createHelpRequest,
  createMessage,
  findPersonalConversation,
  getHelpRequestById,
  isConversationMember,
  listConversationMemberIds,
  listConversations,
  listMessages,
  listOpenHelpRequests,
} from "./repository";
import { findUserById, searchRiders } from "../auth/repository";
import { sendPushToUsersSafe } from "../notifications/service";

const groupSchema = z.object({
  name: z.string().min(2),
  memberIds: z.array(z.string().uuid()).min(1),
});

const personalSchema = z.object({
  peerUserId: z.string().uuid(),
});

const messageSchema = z.object({
  content: z.string().min(1).max(1200),
});

const helpSchema = z.object({
  destinationCity: z.string().min(2),
  destinationState: z.string().min(2),
  message: z.string().min(3).max(1000),
});

export const chatRouter = Router();
chatRouter.use(authGuard);

chatRouter.get("/riders", async (req, res) => {
  const query = String(req.query.q ?? "");
  const city = req.query.city ? String(req.query.city) : undefined;
  const state = req.query.state ? String(req.query.state) : undefined;

  const riders = await searchRiders({
    query: query || undefined,
    city,
    state,
    excludeUserId: req.auth!.userId,
    limit: 30,
  });

  res.json(
    riders.map((rider) => ({
      id: rider.id,
      displayName: rider.display_name,
      city: rider.city,
      state: rider.state,
    })),
  );
});

chatRouter.get("/conversations", async (req, res) => {
  const rows = await listConversations(req.auth!.userId);
  res.json(
    rows.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      createdBy: row.created_by,
      createdAt: row.created_at,
      memberIds: row.member_ids,
      lastMessage: row.last_message,
    })),
  );
});

chatRouter.post("/conversations/personal", async (req, res) => {
  const parsed = personalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const existing = await findPersonalConversation(req.auth!.userId, parsed.data.peerUserId);
  const conversation =
    existing ??
    (await createConversation({
      type: "personal",
      createdBy: req.auth!.userId,
      memberIds: [parsed.data.peerUserId],
    }));

  res.status(existing ? 200 : 201).json({
    id: conversation.id,
    type: conversation.type,
    createdAt: conversation.created_at,
  });
});

chatRouter.post("/conversations/group", async (req, res) => {
  const parsed = groupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const conversation = await createConversation({
    type: "group",
    name: parsed.data.name,
    createdBy: req.auth!.userId,
    memberIds: parsed.data.memberIds,
  });

  res.status(201).json({
    id: conversation.id,
    type: conversation.type,
    name: conversation.name,
    createdAt: conversation.created_at,
  });
});

chatRouter.get("/conversations/:id/messages", async (req, res) => {
  const allowed = await isConversationMember(req.params.id, req.auth!.userId);
  if (!allowed) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const messages = await listMessages(req.params.id);
  res.json(
    messages.map((message) => ({
      id: message.id,
      conversationId: message.conversation_id,
      senderId: message.sender_id,
      content: message.content,
      createdAt: message.created_at,
    })),
  );
});

chatRouter.post("/conversations/:id/messages", async (req, res) => {
  const allowed = await isConversationMember(req.params.id, req.auth!.userId);
  if (!allowed) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const message = await createMessage({
    conversationId: req.params.id,
    senderId: req.auth!.userId,
    content: parsed.data.content,
  });

  const payload = {
    id: message.id,
    conversationId: message.conversation_id,
    senderId: message.sender_id,
    content: message.content,
    createdAt: message.created_at,
  };

  getIoServer()?.to(`chat:${req.params.id}`).emit("chat:message:new", payload);

  const memberIds = await listConversationMemberIds(req.params.id);
  const recipients = memberIds.filter((userId) => userId !== req.auth!.userId);
  await sendPushToUsersSafe({
    userIds: recipients,
    title: "New chat message",
    body: parsed.data.content.slice(0, 120),
    data: { type: "chat_message", conversationId: req.params.id },
  });

  res.status(201).json(payload);
});

chatRouter.post("/help-requests", async (req, res) => {
  const parsed = helpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const help = await createHelpRequest({
    requesterId: req.auth!.userId,
    destinationCity: parsed.data.destinationCity,
    destinationState: parsed.data.destinationState,
    message: parsed.data.message,
  });

  const localRiders = await searchRiders({
    city: parsed.data.destinationCity,
    state: parsed.data.destinationState,
    excludeUserId: req.auth!.userId,
    limit: 50,
  });
  const requester = await findUserById(req.auth!.userId);
  await sendPushToUsersSafe({
    userIds: localRiders.map((rider) => rider.id),
    title: "Local rider needs help",
    body: `${requester?.display_name ?? "A rider"} requested help for ${parsed.data.destinationCity}, ${parsed.data.destinationState}.`,
    data: {
      type: "help_request_open",
      helpRequestId: help.id,
      destinationCity: parsed.data.destinationCity,
      destinationState: parsed.data.destinationState,
    },
  });

  res.status(201).json({
    id: help.id,
    requesterId: help.requester_id,
    destinationCity: help.destination_city,
    destinationState: help.destination_state,
    message: help.message,
    status: help.status,
    createdAt: help.created_at,
  });
});

chatRouter.get("/help-requests/open", async (req, res) => {
  const user = await findUserById(req.auth!.userId);
  const rows = await listOpenHelpRequests(user?.city, user?.state);
  res.json(
    rows.map((row) => ({
      id: row.id,
      requesterId: row.requester_id,
      destinationCity: row.destination_city,
      destinationState: row.destination_state,
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
    })),
  );
});

chatRouter.post("/help-requests/:id/respond", async (req, res) => {
  const help = await getHelpRequestById(req.params.id);
  if (!help || help.status !== "open") {
    res.status(404).json({ message: "Help request unavailable" });
    return;
  }

  const conversation = await createConversation({
    type: "help",
    name: `Help ${help.destination_city}`,
    createdBy: req.auth!.userId,
    memberIds: [help.requester_id],
  });

  await attachHelpConversation({
    helpRequestId: help.id,
    helperUserId: req.auth!.userId,
    conversationId: conversation.id,
  });

  await sendPushToUsersSafe({
    userIds: [help.requester_id],
    title: "Help request matched",
    body: "A local rider responded to your help request. Open chat to coordinate.",
    data: { type: "help_request_matched", helpRequestId: help.id, conversationId: conversation.id },
  });

  res.status(201).json({
    helpRequestId: help.id,
    conversationId: conversation.id,
  });
});
