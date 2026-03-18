import { Router } from "express";
import { z } from "zod";
import { authGuard } from "../../middleware/auth";
import { upsertDeviceToken, deleteDeviceToken } from "./repository";
import { sendPushToUsers } from "./service";

const registerSchema = z.object({
  token: z.string().min(20),
  platform: z.enum(["android", "ios", "web"]),
});

const unregisterSchema = z.object({
  token: z.string().min(20),
});

const testPushSchema = z.object({
  title: z.string().trim().min(2).max(80).default("Rideforge test"),
  body: z.string().trim().min(2).max(240).default("Push notifications are working"),
  data: z.record(z.string()).optional(),
});

export const notificationsRouter = Router();
notificationsRouter.use(authGuard);

notificationsRouter.post("/device-token", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  await upsertDeviceToken({
    userId: req.auth!.userId,
    token: parsed.data.token,
    platform: parsed.data.platform,
  });
  res.status(201).json({ ok: true });
});

notificationsRouter.delete("/device-token", async (req, res) => {
  const parsed = unregisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  await deleteDeviceToken({ userId: req.auth!.userId, token: parsed.data.token });
  res.json({ ok: true });
});

notificationsRouter.post("/test", async (req, res) => {
  const parsed = testPushSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const result = await sendPushToUsers({
    userIds: [req.auth!.userId],
    title: parsed.data.title,
    body: parsed.data.body,
    data: parsed.data.data,
  });

  res.json(result);
});
