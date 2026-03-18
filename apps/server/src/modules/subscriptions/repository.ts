import { db } from "../../db/pg";

export interface SubscriptionRow {
  user_id: string;
  tier: "free" | "pro";
  active: boolean;
  renewal_date?: string;
  provider?: string;
  external_customer_id?: string;
  external_subscription_id?: string;
}

export async function getSubscription(userId: string): Promise<SubscriptionRow | null> {
  const result = await db.query<SubscriptionRow>(
    `SELECT user_id, tier, active, renewal_date, provider, external_customer_id, external_subscription_id
       FROM subscriptions WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function upsertSubscription(input: {
  userId: string;
  tier: "free" | "pro";
  active: boolean;
  renewalDate?: string;
  provider?: string;
  externalCustomerId?: string;
  externalSubscriptionId?: string;
}): Promise<SubscriptionRow> {
  const result = await db.query<SubscriptionRow>(
    `INSERT INTO subscriptions (user_id, tier, active, renewal_date, provider, external_customer_id, external_subscription_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id)
     DO UPDATE SET tier = EXCLUDED.tier,
                   active = EXCLUDED.active,
                   renewal_date = EXCLUDED.renewal_date,
                   provider = EXCLUDED.provider,
                   external_customer_id = EXCLUDED.external_customer_id,
                   external_subscription_id = EXCLUDED.external_subscription_id
     RETURNING user_id, tier, active, renewal_date, provider, external_customer_id, external_subscription_id`,
    [
      input.userId,
      input.tier,
      input.active,
      input.renewalDate ?? null,
      input.provider ?? null,
      input.externalCustomerId ?? null,
      input.externalSubscriptionId ?? null,
    ],
  );
  return result.rows[0];
}

export async function savePaymentEvent(input: {
  userId: string;
  provider: string;
  externalPaymentId?: string;
  amount: number;
  currency: string;
  status: string;
  rawPayload: unknown;
}): Promise<void> {
  await db.query(
    `INSERT INTO payment_events (user_id, provider, external_payment_id, amount, currency, status, raw_payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      input.userId,
      input.provider,
      input.externalPaymentId ?? null,
      input.amount,
      input.currency,
      input.status,
      JSON.stringify(input.rawPayload),
    ],
  );
}
