import { Router } from "express";
import crypto from "crypto";
import Stripe from "stripe";
import { z } from "zod";
import { authGuard } from "../../middleware/auth";
import { env } from "../../config/env";
import { delCache, getJsonCache, setJsonCache } from "../../db/cache";
import { getPaymentProvider } from "./paymentProvider";
import { getSubscription, savePaymentEvent, upsertSubscription } from "./repository";

const updateSubscriptionSchema = z.object({
  tier: z.enum(["free", "pro"]),
});

const checkoutSchema = z.object({
  amount: z.number().min(1),
  currency: z.string().default("usd"),
});

export const subscriptionsRouter = Router();

subscriptionsRouter.get("/me", authGuard, async (req, res) => {
  const cacheKey = `sub:${req.auth!.userId}`;
  const cached = await getJsonCache<unknown>(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const sub =
    (await getSubscription(req.auth!.userId)) ?? {
      user_id: req.auth!.userId,
      tier: "free" as const,
      active: true,
      renewal_date: null,
      provider: null,
    };

  const payload = {
    userId: sub.user_id,
    tier: sub.tier,
    active: sub.active,
    renewalDate: sub.renewal_date,
    provider: sub.provider ?? null,
  };
  await setJsonCache(cacheKey, payload, 60);
  res.json(payload);
});

subscriptionsRouter.post("/me", authGuard, async (req, res) => {
  const parsed = updateSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const updated = await upsertSubscription({
    userId: req.auth!.userId,
    tier: parsed.data.tier,
    active: true,
    renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    provider: env.paymentProvider,
  });

  await delCache(`sub:${req.auth!.userId}`);
  res.json({
    userId: updated.user_id,
    tier: updated.tier,
    active: updated.active,
    renewalDate: updated.renewal_date,
    provider: updated.provider,
  });
});

subscriptionsRouter.post("/checkout", authGuard, async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const provider = getPaymentProvider();
  const session = await provider.createCheckout({
    userId: req.auth!.userId,
    amount: parsed.data.amount,
    currency: parsed.data.currency,
  });

  await savePaymentEvent({
    userId: req.auth!.userId,
    provider: session.provider,
    externalPaymentId: session.sessionId,
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    status: "created",
    rawPayload: session,
  });

  res.status(201).json(session);
});

subscriptionsRouter.post("/webhook", async (req, res) => {
  let payload: any = {};
  let userId = "";

  if (env.paymentProvider === "stripe") {
    if (!env.stripeSecretKey || !env.stripeWebhookSecret) {
      res.status(500).json({ message: "Stripe secrets are not configured" });
      return;
    }
    const stripeSignature = String(req.headers["stripe-signature"] ?? "");
    if (!stripeSignature) {
      res.status(400).json({ message: "Missing stripe-signature header" });
      return;
    }

    try {
      const stripe = new Stripe(env.stripeSecretKey);
      const event = stripe.webhooks.constructEvent(req.body as Buffer, stripeSignature, env.stripeWebhookSecret);
      payload = event.data.object as any;
      userId = String(payload?.metadata?.userId ?? "");
    } catch (error) {
      res.status(400).json({ message: `Invalid Stripe webhook signature: ${String(error)}` });
      return;
    }
  } else if (env.paymentProvider === "razorpay") {
    const signature = String(req.headers["x-razorpay-signature"] ?? "");
    if (!env.razorpayKeySecret || !signature) {
      res.status(400).json({ message: "Missing Razorpay signature configuration/header" });
      return;
    }

    const rawBody = (req.body as Buffer).toString("utf8");
    const expected = crypto.createHmac("sha256", env.razorpayKeySecret).update(rawBody).digest("hex");
    if (signature !== expected) {
      res.status(400).json({ message: "Invalid Razorpay signature" });
      return;
    }

    payload = JSON.parse(rawBody);
    userId = String(payload?.payload?.payment?.entity?.notes?.userId ?? "");
  } else {
    payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    userId = String(payload?.app_user_id ?? payload?.metadata?.userId ?? "");
  }

  if (userId) {
    await upsertSubscription({
      userId,
      tier: "pro",
      active: true,
      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      provider: env.paymentProvider,
      externalCustomerId: String(payload?.customer ?? payload?.customer_id ?? ""),
      externalSubscriptionId: String(payload?.id ?? payload?.event ?? ""),
    });
    await delCache(`sub:${userId}`);
  }

  await savePaymentEvent({
    userId: userId || "unknown",
    provider: env.paymentProvider,
    externalPaymentId: String(payload?.id ?? ""),
    amount: Number(payload?.amount ?? 0),
    currency: String(payload?.currency ?? "usd"),
    status: String(payload?.status ?? payload?.event ?? "webhook"),
    rawPayload: payload,
  });

  res.json({ received: true });
});
