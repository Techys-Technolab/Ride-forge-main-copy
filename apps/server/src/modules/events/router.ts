import { Router } from "express";
import { z } from "zod";
import { authGuard } from "../../middleware/auth";
import { getIoServer } from "../realtime/gateway";
import { createConversation, createMessage, findPersonalConversation } from "../chat/repository";
import { sendPushToUsersSafe } from "../notifications/service";
import { findEventById, createEvent, isEventAttendee, listEvents, rsvpEvent } from "./repository";

const createEventSchema = z.object({
  kind: z.enum(["ride", "event"]).default("event"),
  title: z.string().min(3),
  description: z.string().max(2000).optional(),
  startAt: z.string(),
  locationName: z.string().min(2),
  lat: z.number(),
  lng: z.number(),
});

const contactSchema = z.object({
  message: z.string().min(2).max(1000),
});

export const eventsRouter = Router();
eventsRouter.use(authGuard);

eventsRouter.post("/", async (req, res) => {
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const event = await createEvent({
    hostId: req.auth!.userId,
    kind: parsed.data.kind,
    title: parsed.data.title,
    description: parsed.data.description,
    startAt: parsed.data.startAt,
    locationName: parsed.data.locationName,
    lat: parsed.data.lat,
    lng: parsed.data.lng,
  });

  await sendPushToUsersSafe({
    userIds: [req.auth!.userId],
    title: event.kind === "ride" ? "Ride published" : "Event published",
    body: `Your ${event.kind} listing "${event.title}" is now live.`,
    data: { type: "event_published", eventId: event.id, kind: event.kind },
  });

  res.status(201).json({
    id: event.id,
    hostId: event.host_id,
    kind: event.kind,
    title: event.title,
    description: event.description,
    startAt: event.start_at,
    locationName: event.location_name,
    lat: Number(event.lat),
    lng: Number(event.lng),
    attendeeIds: [req.auth!.userId],
  });
});

eventsRouter.get("/", async (_req, res) => {
  const events = await listEvents();
  res.json(
    events.map((event) => ({
      id: event.id,
      hostId: event.host_id,
      kind: event.kind,
      title: event.title,
      description: event.description,
      startAt: event.start_at,
      locationName: event.location_name,
      lat: Number(event.lat),
      lng: Number(event.lng),
      attendeeIds: event.attendee_ids,
    })),
  );
});

eventsRouter.post("/:id/interest", async (req, res) => {
  const event = await findEventById(req.params.id);
  if (!event) {
    res.status(404).json({ message: "Event not found" });
    return;
  }

  const alreadyInterested = await isEventAttendee(event.id, req.auth!.userId);
  await rsvpEvent(event.id, req.auth!.userId);
  if (!alreadyInterested && event.host_id !== req.auth!.userId) {
    await sendPushToUsersSafe({
      userIds: [event.host_id],
      title: "New interest on your listing",
      body: `A rider is interested in your ${event.kind}: ${event.title}.`,
      data: { type: "event_interest", eventId: event.id, kind: event.kind },
    });
  }
  const updated = await listEvents();
  const target = updated.find((row) => row.id === event.id);

  res.json({
    id: event.id,
    hostId: event.host_id,
    kind: event.kind,
    title: event.title,
    description: event.description,
    startAt: event.start_at,
    locationName: event.location_name,
    lat: Number(event.lat),
    lng: Number(event.lng),
    attendeeIds: target?.attendee_ids ?? [req.auth!.userId],
  });
});

eventsRouter.post("/:id/rsvp", async (req, res) => {
  const event = await findEventById(req.params.id);
  if (!event) {
    res.status(404).json({ message: "Event not found" });
    return;
  }

  const alreadyInterested = await isEventAttendee(event.id, req.auth!.userId);
  await rsvpEvent(event.id, req.auth!.userId);
  if (!alreadyInterested && event.host_id !== req.auth!.userId) {
    await sendPushToUsersSafe({
      userIds: [event.host_id],
      title: "New interest on your listing",
      body: `A rider is interested in your ${event.kind}: ${event.title}.`,
      data: { type: "event_interest", eventId: event.id, kind: event.kind },
    });
  }
  const updated = await listEvents();
  const target = updated.find((row) => row.id === event.id);

  res.json({
    id: event.id,
    hostId: event.host_id,
    kind: event.kind,
    title: event.title,
    description: event.description,
    startAt: event.start_at,
    locationName: event.location_name,
    lat: Number(event.lat),
    lng: Number(event.lng),
    attendeeIds: target?.attendee_ids ?? [req.auth!.userId],
  });
});

eventsRouter.post("/:id/contact", async (req, res) => {
  const event = await findEventById(req.params.id);
  if (!event) {
    res.status(404).json({ message: "Event not found" });
    return;
  }

  if (event.host_id === req.auth!.userId) {
    res.status(400).json({ message: "Creator cannot contact own listing" });
    return;
  }

  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const existing = await findPersonalConversation(req.auth!.userId, event.host_id);
  const conversation =
    existing ??
    (await createConversation({
      type: "personal",
      createdBy: req.auth!.userId,
      memberIds: [event.host_id],
    }));

  const intro = `[${event.kind.toUpperCase()}] ${event.title}: ${parsed.data.message}`;
  const message = await createMessage({
    conversationId: conversation.id,
    senderId: req.auth!.userId,
    content: intro,
  });

  const payload = {
    id: message.id,
    conversationId: message.conversation_id,
    senderId: message.sender_id,
    content: message.content,
    createdAt: message.created_at,
  };
  getIoServer()?.to(`chat:${conversation.id}`).emit("chat:message:new", payload);
  await sendPushToUsersSafe({
    userIds: [event.host_id],
    title: "Ride/Event inquiry",
    body: `${event.kind === "ride" ? "Ride" : "Event"} question: ${event.title}`,
    data: { type: "event_contact", eventId: event.id, conversationId: conversation.id },
  });

  res.status(existing ? 200 : 201).json({
    conversationId: conversation.id,
    messageId: message.id,
    sentAt: message.created_at,
  });
});
