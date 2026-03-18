import { Router } from "express";
import crypto from "crypto";
import Stripe from "stripe";
import { z } from "zod";
import { env } from "../../config/env";
import { authGuard } from "../../middleware/auth";
import { adminGuard } from "../../middleware/admin";
import { requireIdempotency } from "../../middleware/idempotency";
import { getIoServer } from "../realtime/gateway";
import { getRewardBalance, redeemRewardPoints } from "../rewards/repository";
import { sendPushToUsersSafe } from "../notifications/service";
import { CheckoutSessionResult, getPaymentProvider } from "../subscriptions/paymentProvider";
import {
  createOrder,
  ensureSeedProducts,
  getOrderById,
  getOrderByIdAny,
  getOrderBySessionId,
  getProductsByIds,
  listOrderItems,
  listOrders,
  listOrderStatusEvents,
  listProducts,
  markOrderPaid,
  pushOrderStatus,
} from "./repository";

const createOrderSchema = z.object({
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().positive() })).min(1),
  redeemPoints: z.number().int().min(0).default(0),
  shippingOption: z.enum(["standard", "express", "priority"]).default("standard"),
  shippingAddressLine1: z.string().min(4),
  shippingPostalCode: z.string().min(3),
  shippingCity: z.string().min(2),
  shippingState: z.string().min(2),
  shippingCountry: z.string().min(2),
});

const statusSchema = z.object({
  status: z.enum(["confirmed", "packed", "shipped", "out_for_delivery", "delivered"]),
  note: z.string().max(500).optional(),
});

const POINT_TO_CENT = 10;
const SHIPPING_FEES: Record<"standard" | "express" | "priority", number> = {
  standard: 0,
  express: 799,
  priority: 1499,
};

export const storeRouter = Router();

storeRouter.get("/products", authGuard, async (_req, res) => {
  await ensureSeedProducts();
  const products = await listProducts();
  res.json(
    products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      priceCents: Number(product.price_cents),
      currency: product.currency,
      stockQty: Number(product.stock_qty),
      imageUrl: product.image_url,
      isActive: product.is_active,
    })),
  );
});

storeRouter.get("/products/:id", authGuard, async (req, res) => {
  await ensureSeedProducts();
  const rows = await getProductsByIds([req.params.id]);
  if (!rows[0]) {
    res.status(404).json({ message: "Product not found" });
    return;
  }
  const product = rows[0];
  res.json({
    id: product.id,
    name: product.name,
    description: product.description,
    priceCents: Number(product.price_cents),
    currency: product.currency,
    stockQty: Number(product.stock_qty),
    imageUrl: product.image_url,
    isActive: product.is_active,
  });
});

storeRouter.post("/orders", authGuard, requireIdempotency(), async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const products = await getProductsByIds(parsed.data.items.map((item) => item.productId));
  if (products.length !== parsed.data.items.length) {
    res.status(404).json({ message: "One or more products not found" });
    return;
  }

  const productMap = new Map(products.map((product) => [product.id, product]));
  const orderItems = parsed.data.items.map((item) => {
    const product = productMap.get(item.productId)!;
    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPriceCents: Number(product.price_cents),
    };
  });

  const outOfStock = orderItems.find((item) => {
    const product = productMap.get(item.productId)!;
    return item.quantity > Number(product.stock_qty);
  });
  if (outOfStock) {
    const product = productMap.get(outOfStock.productId)!;
    res.status(400).json({ message: `Insufficient stock for ${product.name}` });
    return;
  }

  const subtotal = orderItems.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  const shippingFee = SHIPPING_FEES[parsed.data.shippingOption];
  const payableBeforeRedeem = subtotal + shippingFee;

  const maxRedeemPoints = Math.floor(payableBeforeRedeem / POINT_TO_CENT);
  const requestedRedeemPoints = parsed.data.redeemPoints;
  const appliedRedeemPoints = Math.min(requestedRedeemPoints, maxRedeemPoints);
  const redeemDiscount = appliedRedeemPoints * POINT_TO_CENT;
  const total = Math.max(payableBeforeRedeem - redeemDiscount, 0);

  if (appliedRedeemPoints > 0 && total === 0) {
    const redeemResult = await redeemRewardPoints({
      userId: req.auth!.userId,
      points: appliedRedeemPoints,
      reason: "store_redemption",
      metadata: { subtotal, shippingFee, total },
    });

    if (!redeemResult.ok) {
      res.status(400).json({ message: "Insufficient reward points", balance: redeemResult.balance });
      return;
    }
  } else if (appliedRedeemPoints > 0 && total > 0) {
    const currentBalance = await getRewardBalance(req.auth!.userId);
    if (currentBalance < appliedRedeemPoints) {
      res.status(400).json({ message: "Insufficient reward points", balance: currentBalance });
      return;
    }
  }

  let paymentStatus: "pending" | "paid" = "paid";
  let paymentProvider = "reward_points";
  let checkoutSession: CheckoutSessionResult | undefined;

  if (total > 0) {
    paymentStatus = "pending";
    checkoutSession = await getPaymentProvider().createCheckout({
      userId: req.auth!.userId,
      amount: total,
      currency: "usd",
      itemName: "Rideforge Gear Order",
      metadata: { purpose: "store_order" },
    });
    paymentProvider = checkoutSession.provider;
  }

  const order = await createOrder({
    userId: req.auth!.userId,
    currency: "usd",
    subtotalCents: subtotal,
    shippingFeeCents: shippingFee,
    shippingOption: parsed.data.shippingOption,
    totalCents: total,
    redeemPointsUsed: appliedRedeemPoints,
    paymentProvider,
    paymentStatus,
    paymentSessionId: checkoutSession?.sessionId,
    shippingAddressLine1: parsed.data.shippingAddressLine1,
    shippingPostalCode: parsed.data.shippingPostalCode,
    shippingCity: parsed.data.shippingCity,
    shippingState: parsed.data.shippingState,
    shippingCountry: parsed.data.shippingCountry,
    items: orderItems,
  });

  if (paymentStatus === "paid") {
    await markOrderPaid({ orderId: order.id, provider: "reward_points", note: "Order paid via reward points" });
    await sendPushToUsersSafe({
      userIds: [order.user_id],
      title: "Order confirmed",
      body: "Your Rideforge store order is confirmed.",
      data: { type: "store_order", orderId: order.id, status: "confirmed" },
    });
  }

  const payload = {
    id: order.id,
    userId: order.user_id,
    status: paymentStatus === "paid" ? "confirmed" : order.status,
    subtotalCents: Number(order.subtotal_cents),
    shippingFeeCents: Number(order.shipping_fee_cents),
    shippingOption: order.shipping_option ?? "standard",
    totalCents: Number(order.total_cents),
    currency: order.currency,
    redeemPointsRequested: requestedRedeemPoints,
    redeemPointsUsed: Number(order.redeem_points_used),
    paymentStatus,
    shipping: {
      addressLine1: order.shipping_address_line1,
      postalCode: order.shipping_postal_code,
      city: order.shipping_city,
      state: order.shipping_state,
      country: order.shipping_country,
    },
    checkout: checkoutSession
      ? {
          provider: checkoutSession.provider,
          sessionId: checkoutSession.sessionId,
          checkoutUrl: checkoutSession.checkoutUrl,
          metadata: checkoutSession.metadata,
        }
      : null,
    createdAt: order.created_at,
  };

  getIoServer()?.to(`order:${order.id}`).emit("order:status:update", {
    orderId: order.id,
    status: payload.status,
    note: paymentStatus === "paid" ? "Order paid and confirmed" : "Order created; awaiting payment",
    createdAt: new Date().toISOString(),
  });

  res.status(201).json(payload);
});

storeRouter.post("/webhook", async (req, res) => {
  let payload: any = {};
  let sessionId = "";
  let referenceId = "";

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
      sessionId = String(payload?.id ?? "");
      referenceId = String(payload?.payment_intent ?? payload?.id ?? "");

      if (event.type !== "checkout.session.completed") {
        res.json({ received: true, ignored: event.type });
        return;
      }
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
    sessionId = String(payload?.payload?.payment?.entity?.order_id ?? "");
    referenceId = String(payload?.payload?.payment?.entity?.id ?? "");
  } else {
    if (Buffer.isBuffer(req.body)) {
      payload = JSON.parse(req.body.toString("utf8"));
    } else if (typeof req.body === "string") {
      payload = JSON.parse(req.body);
    } else {
      payload = req.body;
    }
    sessionId = String(payload?.metadata?.sessionId ?? payload?.id ?? "");
    referenceId = String(payload?.transaction_id ?? payload?.id ?? "");
  }

  if (!sessionId) {
    res.status(400).json({ message: "No payment session found in webhook payload" });
    return;
  }

  const order = await getOrderBySessionId(sessionId);
  if (!order) {
    res.status(404).json({ message: "Order not found for payment session" });
    return;
  }

  if (order.payment_status !== "paid") {
    if (Number(order.redeem_points_used) > 0) {
      const redeemResult = await redeemRewardPoints({
        userId: order.user_id,
        points: Number(order.redeem_points_used),
        reason: "store_redemption",
        metadata: { orderId: order.id, paymentReferenceId: referenceId },
      });

      if (!redeemResult.ok) {
        res.status(400).json({ message: "Insufficient reward points at payment finalization" });
        return;
      }
    }

    await markOrderPaid({
      orderId: order.id,
      provider: env.paymentProvider,
      paymentReferenceId: referenceId,
      note: "Payment confirmed from webhook",
    });
    await sendPushToUsersSafe({
      userIds: [order.user_id],
      title: "Payment successful",
      body: "Your payment was confirmed and your order is now processing.",
      data: { type: "store_order", orderId: order.id, status: "confirmed" },
    });

    getIoServer()?.to(`order:${order.id}`).emit("order:status:update", {
      orderId: order.id,
      status: "confirmed",
      note: "Payment confirmed",
      createdAt: new Date().toISOString(),
    });
  }

  res.json({ received: true, orderId: order.id });
});

storeRouter.get("/orders", authGuard, async (req, res) => {
  const orders = await listOrders(req.auth!.userId);
  res.json(
    orders.map((order) => ({
      id: order.id,
      status: order.status,
      subtotalCents: Number(order.subtotal_cents),
      shippingFeeCents: Number(order.shipping_fee_cents),
      shippingOption: order.shipping_option ?? "standard",
      totalCents: Number(order.total_cents),
      currency: order.currency,
      createdAt: order.created_at,
      paymentStatus: order.payment_status,
      paymentProvider: order.payment_provider,
      paymentSessionId: order.payment_session_id,
      shipping: {
        addressLine1: order.shipping_address_line1,
        postalCode: order.shipping_postal_code,
        city: order.shipping_city,
        state: order.shipping_state,
        country: order.shipping_country,
      },
    })),
  );
});

storeRouter.get("/orders/:id", authGuard, async (req, res) => {
  const order = await getOrderById(req.params.id, req.auth!.userId);
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }

  const items = await listOrderItems(order.id);
  const timeline = await listOrderStatusEvents(order.id);

  res.json({
    id: order.id,
    status: order.status,
    subtotalCents: Number(order.subtotal_cents),
    shippingFeeCents: Number(order.shipping_fee_cents),
    shippingOption: order.shipping_option ?? "standard",
    totalCents: Number(order.total_cents),
    currency: order.currency,
    redeemPointsUsed: Number(order.redeem_points_used),
    createdAt: order.created_at,
    paymentStatus: order.payment_status,
    paymentProvider: order.payment_provider,
    paymentSessionId: order.payment_session_id,
    paymentReferenceId: order.payment_reference_id,
    shipping: {
      addressLine1: order.shipping_address_line1,
      postalCode: order.shipping_postal_code,
      city: order.shipping_city,
      state: order.shipping_state,
      country: order.shipping_country,
    },
    items: items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      quantity: Number(item.quantity),
      unitPriceCents: Number(item.unit_price_cents),
    })),
    timeline: timeline.map((entry) => ({
      id: entry.id,
      status: entry.status,
      note: entry.note,
      createdAt: entry.created_at,
    })),
  });
});

storeRouter.get("/orders/:id/events", authGuard, async (req, res) => {
  const order = await getOrderById(req.params.id, req.auth!.userId);
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }

  const events = await listOrderStatusEvents(order.id);
  res.json(events.map((entry) => ({ id: entry.id, status: entry.status, note: entry.note, createdAt: entry.created_at })));
});

storeRouter.post("/orders/:id/status", authGuard, async (_req, res) => {
  res.status(403).json({ message: "Use admin shipping update endpoint" });
});

storeRouter.post("/admin/orders/:id/status", authGuard, adminGuard, async (req, res) => {
  const order = await getOrderByIdAny(req.params.id);
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }

  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  await pushOrderStatus(order.id, parsed.data.status, parsed.data.note);
  const payload = {
    orderId: order.id,
    status: parsed.data.status,
    note: parsed.data.note,
    createdAt: new Date().toISOString(),
  };

  getIoServer()?.to(`order:${order.id}`).emit("order:status:update", payload);
  await sendPushToUsersSafe({
    userIds: [order.user_id],
    title: "Order status update",
    body: `Your order is now ${parsed.data.status.replaceAll("_", " ")}.`,
    data: { type: "store_order", orderId: order.id, status: parsed.data.status },
  });
  res.json(payload);
});
