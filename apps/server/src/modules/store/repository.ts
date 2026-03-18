import { db } from "../../db/pg";

export interface ProductRow {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  stock_qty: number;
  image_url?: string;
  is_active: boolean;
}

export interface OrderRow {
  id: string;
  user_id: string;
  status: string;
  total_cents: number;
  subtotal_cents: number;
  shipping_fee_cents: number;
  shipping_option?: string;
  currency: string;
  redeem_points_used: number;
  payment_provider?: string;
  payment_status: string;
  payment_session_id?: string;
  payment_reference_id?: string;
  shipping_address_line1?: string;
  shipping_postal_code?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_country?: string;
  created_at: string;
}

export async function ensureSeedProducts(): Promise<void> {
  const products = [
    {
      name: "Apex Touring Helmet",
      description: "DOT-certified full-face helmet with anti-fog visor and emergency quick-release padding.",
      priceCents: 21999,
      currency: "usd",
      stockQty: 120,
      imageUrl: "https://images.unsplash.com/photo-1591370874773-6702e8f12fd8",
    },
    {
      name: "Urban Mesh Riding Jacket",
      description: "Breathable CE-armored jacket for city and summer touring rides.",
      priceCents: 16999,
      currency: "usd",
      stockQty: 80,
      imageUrl: "https://images.unsplash.com/photo-1558981285-6f0c94958bb6",
    },
    {
      name: "Stormproof Riding Pants",
      description: "Abrasion-resistant riding pants with waterproof membrane and knee armor.",
      priceCents: 13999,
      currency: "usd",
      stockQty: 95,
      imageUrl: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518",
    },
    {
      name: "RoadGrip Protective Gloves",
      description: "Knuckle-protected all-weather gloves with touchscreen fingertips.",
      priceCents: 5999,
      currency: "usd",
      stockQty: 210,
      imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff",
    },
    {
      name: "Enduro Riding Boots",
      description: "Ankle-stabilized boots with reinforced toe box and anti-slip sole.",
      priceCents: 14999,
      currency: "usd",
      stockQty: 70,
      imageUrl: "https://images.unsplash.com/photo-1549298916-b41d501d3772",
    },
    {
      name: "Rideforge Performance T-Shirt",
      description: "Moisture-wicking rider tee with stretch fabric for long day comfort.",
      priceCents: 3499,
      currency: "usd",
      stockQty: 260,
      imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab",
    },
    {
      name: "Helmet Bluetooth Intercom",
      description: "Rider-to-rider communication with wind-noise suppression.",
      priceCents: 12999,
      currency: "usd",
      stockQty: 130,
      imageUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9",
    },
    {
      name: "Bar-Mount Phone Holder",
      description: "Vibration-dampened metal mount with one-tap secure locking.",
      priceCents: 3999,
      currency: "usd",
      stockQty: 280,
      imageUrl: "https://images.unsplash.com/photo-1525909002-1b05e0c869d8",
    },
    {
      name: "Saddlebags 30L Pair",
      description: "Water-resistant dual saddlebags with reflective strips and quick-release setup.",
      priceCents: 9999,
      currency: "usd",
      stockQty: 90,
      imageUrl: "https://images.unsplash.com/photo-1626379864164-2059d9f73278",
    },
    {
      name: "Chain Care Kit",
      description: "Complete cleaning brush, lube spray, and degreaser maintenance bundle.",
      priceCents: 2499,
      currency: "usd",
      stockQty: 320,
      imageUrl: "https://images.unsplash.com/photo-1607860108855-64acf2078ed9",
    },
  ];

  for (const product of products) {
    await db.query(
      `INSERT INTO products (name, description, price_cents, currency, stock_qty, image_url, is_active)
       SELECT $1, $2, $3, $4, $5, $6, true
       WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = $1)`,
      [product.name, product.description, product.priceCents, product.currency, product.stockQty, product.imageUrl],
    );
  }
}

export async function listProducts(): Promise<ProductRow[]> {
  const result = await db.query<ProductRow>(
    `SELECT id, name, description, price_cents, currency, stock_qty, image_url, is_active
       FROM products
      WHERE is_active = true
      ORDER BY created_at DESC`,
  );
  return result.rows;
}

export async function getProductsByIds(productIds: string[]): Promise<ProductRow[]> {
  const result = await db.query<ProductRow>(
    `SELECT id, name, description, price_cents, currency, stock_qty, image_url, is_active
       FROM products
      WHERE id = ANY($1::uuid[])`,
    [productIds],
  );
  return result.rows;
}

export async function createOrder(input: {
  userId: string;
  currency: string;
  subtotalCents: number;
  shippingFeeCents: number;
  shippingOption?: string;
  totalCents: number;
  redeemPointsUsed: number;
  paymentProvider: string;
  paymentStatus: string;
  paymentSessionId?: string;
  shippingAddressLine1?: string;
  shippingPostalCode?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingCountry?: string;
  items: Array<{ productId: string; quantity: number; unitPriceCents: number }>;
}): Promise<OrderRow> {
  await db.query("BEGIN");
  try {
    const orderResult = await db.query<OrderRow>(
      `INSERT INTO orders (
         user_id, status, total_cents, subtotal_cents, shipping_fee_cents, shipping_option, currency,
         redeem_points_used, payment_provider, payment_status, payment_session_id,
         shipping_address_line1, shipping_postal_code, shipping_city, shipping_state, shipping_country
       )
       VALUES ($1, 'created', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id, user_id, status, total_cents, subtotal_cents, shipping_fee_cents, shipping_option, currency, redeem_points_used, payment_provider, payment_status, payment_session_id, payment_reference_id, shipping_address_line1, shipping_postal_code, shipping_city, shipping_state, shipping_country, created_at`,
      [
        input.userId,
        input.totalCents,
        input.subtotalCents,
        input.shippingFeeCents,
        input.shippingOption ?? null,
        input.currency,
        input.redeemPointsUsed,
        input.paymentProvider,
        input.paymentStatus,
        input.paymentSessionId ?? null,
        input.shippingAddressLine1 ?? null,
        input.shippingPostalCode ?? null,
        input.shippingCity ?? null,
        input.shippingState ?? null,
        input.shippingCountry ?? null,
      ],
    );

    for (const item of input.items) {
      await db.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents)
         VALUES ($1, $2, $3, $4)`,
        [orderResult.rows[0].id, item.productId, item.quantity, item.unitPriceCents],
      );

      await db.query(`UPDATE products SET stock_qty = stock_qty - $2 WHERE id = $1`, [item.productId, item.quantity]);
    }

    await db.query(
      `INSERT INTO order_status_events (order_id, status, note)
       VALUES ($1, 'created', 'Order placed successfully')`,
      [orderResult.rows[0].id],
    );

    await db.query("COMMIT");
    return orderResult.rows[0];
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}

export async function listOrders(userId: string): Promise<OrderRow[]> {
  const result = await db.query<OrderRow>(
    `SELECT id, user_id, status, total_cents, subtotal_cents, shipping_fee_cents, shipping_option, currency, redeem_points_used, payment_provider, payment_status, payment_session_id, payment_reference_id, shipping_address_line1, shipping_postal_code, shipping_city, shipping_state, shipping_country, created_at
       FROM orders
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [userId],
  );
  return result.rows;
}

export async function getOrderById(orderId: string, userId: string): Promise<OrderRow | null> {
  const result = await db.query<OrderRow>(
    `SELECT id, user_id, status, total_cents, subtotal_cents, shipping_fee_cents, shipping_option, currency, redeem_points_used, payment_provider, payment_status, payment_session_id, payment_reference_id, shipping_address_line1, shipping_postal_code, shipping_city, shipping_state, shipping_country, created_at
       FROM orders
      WHERE id = $1 AND user_id = $2
      LIMIT 1`,
    [orderId, userId],
  );
  return result.rows[0] ?? null;
}

export async function getOrderByIdAny(orderId: string): Promise<OrderRow | null> {
  const result = await db.query<OrderRow>(
    `SELECT id, user_id, status, total_cents, subtotal_cents, shipping_fee_cents, shipping_option, currency, redeem_points_used, payment_provider, payment_status, payment_session_id, payment_reference_id, shipping_address_line1, shipping_postal_code, shipping_city, shipping_state, shipping_country, created_at
       FROM orders
      WHERE id = $1
      LIMIT 1`,
    [orderId],
  );
  return result.rows[0] ?? null;
}

export async function getOrderBySessionId(paymentSessionId: string): Promise<OrderRow | null> {
  const result = await db.query<OrderRow>(
    `SELECT id, user_id, status, total_cents, subtotal_cents, shipping_fee_cents, shipping_option, currency, redeem_points_used, payment_provider, payment_status, payment_session_id, payment_reference_id, shipping_address_line1, shipping_postal_code, shipping_city, shipping_state, shipping_country, created_at
       FROM orders
      WHERE payment_session_id = $1
      LIMIT 1`,
    [paymentSessionId],
  );
  return result.rows[0] ?? null;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price_cents: number;
}

export async function listOrderItems(orderId: string): Promise<OrderItemRow[]> {
  const result = await db.query<OrderItemRow>(
    `SELECT id, order_id, product_id, quantity, unit_price_cents
       FROM order_items
      WHERE order_id = $1`,
    [orderId],
  );
  return result.rows;
}

interface OrderStatusRow {
  id: string;
  order_id: string;
  status: string;
  note?: string;
  created_at: string;
}

export async function listOrderStatusEvents(orderId: string): Promise<OrderStatusRow[]> {
  const result = await db.query<OrderStatusRow>(
    `SELECT id, order_id, status, note, created_at
       FROM order_status_events
      WHERE order_id = $1
      ORDER BY created_at ASC`,
    [orderId],
  );
  return result.rows;
}

export async function pushOrderStatus(orderId: string, status: string, note?: string): Promise<void> {
  await db.query("BEGIN");
  try {
    await db.query(`UPDATE orders SET status = $2 WHERE id = $1`, [orderId, status]);
    await db.query(`INSERT INTO order_status_events (order_id, status, note) VALUES ($1, $2, $3)`, [orderId, status, note ?? null]);
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}

export async function markOrderPaid(input: {
  orderId: string;
  paymentReferenceId?: string;
  provider: string;
  note?: string;
}): Promise<void> {
  await db.query("BEGIN");
  try {
    await db.query(
      `UPDATE orders
          SET payment_status = 'paid',
              payment_provider = $2,
              payment_reference_id = COALESCE($3, payment_reference_id),
              status = CASE WHEN status = 'created' THEN 'confirmed' ELSE status END
        WHERE id = $1`,
      [input.orderId, input.provider, input.paymentReferenceId ?? null],
    );
    await db.query(
      `INSERT INTO order_status_events (order_id, status, note)
       VALUES ($1, 'confirmed', $2)`,
      [input.orderId, input.note ?? "Payment confirmed"],
    );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}
