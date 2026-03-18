import Stripe from "stripe";
import Razorpay from "razorpay";
import { env } from "../../config/env";

export interface CheckoutSessionResult {
  provider: "stripe" | "razorpay" | "revenuecat";
  sessionId: string;
  checkoutUrl?: string;
  metadata?: Record<string, string>;
}

interface PaymentProvider {
  createCheckout(args: {
    userId: string;
    amount: number;
    currency: string;
    metadata?: Record<string, string>;
    itemName?: string;
  }): Promise<CheckoutSessionResult>;
}

class StripeProvider implements PaymentProvider {
  private stripe: Stripe;

  constructor() {
    if (!env.stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY is required for Stripe provider");
    }
    this.stripe = new Stripe(env.stripeSecretKey);
  }

  async createCheckout(args: {
    userId: string;
    amount: number;
    currency: string;
    metadata?: Record<string, string>;
    itemName?: string;
  }): Promise<CheckoutSessionResult> {
    const metadata = { userId: args.userId, ...(args.metadata ?? {}) };
    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: args.currency,
            product_data: { name: args.itemName ?? "Rideforge Purchase" },
            unit_amount: args.amount,
          },
          quantity: 1,
        },
      ],
      success_url: env.checkoutSuccessUrl,
      cancel_url: env.checkoutCancelUrl,
      metadata,
    });

    return {
      provider: "stripe",
      sessionId: session.id,
      checkoutUrl: session.url ?? undefined,
      metadata,
    };
  }
}

class RazorpayProvider implements PaymentProvider {
  private razorpay: Razorpay;

  constructor() {
    if (!env.razorpayKeyId || !env.razorpayKeySecret) {
      throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required for Razorpay provider");
    }
    this.razorpay = new Razorpay({ key_id: env.razorpayKeyId, key_secret: env.razorpayKeySecret });
  }

  async createCheckout(args: {
    userId: string;
    amount: number;
    currency: string;
    metadata?: Record<string, string>;
    itemName?: string;
  }): Promise<CheckoutSessionResult> {
    const metadata = { userId: args.userId, ...(args.metadata ?? {}) };
    const order = await this.razorpay.orders.create({
      amount: args.amount,
      currency: args.currency.toUpperCase(),
      receipt: `rf-${args.userId}-${Date.now()}`,
      notes: metadata,
    });

    return {
      provider: "razorpay",
      sessionId: order.id,
      metadata,
    };
  }
}

class RevenueCatProvider implements PaymentProvider {
  async createCheckout(args: {
    userId: string;
    amount: number;
    currency: string;
    metadata?: Record<string, string>;
    itemName?: string;
  }): Promise<CheckoutSessionResult> {
    const metadata = { userId: args.userId, ...(args.metadata ?? {}) };
    return {
      provider: "revenuecat",
      sessionId: `rc-${args.userId}-${Date.now()}`,
      metadata: { ...metadata, amount: String(args.amount), currency: args.currency },
    };
  }
}

export function getPaymentProvider(): PaymentProvider {
  if (env.paymentProvider === "stripe") return new StripeProvider();
  if (env.paymentProvider === "razorpay") return new RazorpayProvider();
  return new RevenueCatProvider();
}
