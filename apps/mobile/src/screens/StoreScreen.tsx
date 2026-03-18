import React, { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Image, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { ScreenTitle } from "../components/ScreenTitle";
import { SurfaceCard } from "../components/SurfaceCard";
import { api } from "../services/api";
import { getSocket } from "../services/socket";
import { useAuthStore } from "../state/authStore";
import { theme } from "../theme/theme";

type Product = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  stockQty: number;
  imageUrl?: string;
};

type Order = {
  id: string;
  status: string;
  subtotalCents: number;
  shippingFeeCents: number;
  shippingOption: "standard" | "express" | "priority";
  totalCents: number;
  currency: string;
  createdAt: string;
  paymentStatus: string;
  shipping?: {
    addressLine1?: string;
    postalCode?: string;
    city?: string;
    state?: string;
    country?: string;
  };
};

type OrderEvent = {
  id: string;
  status: string;
  note?: string;
  createdAt: string;
};

const SHIPPING_FLOW = ["confirmed", "packed", "shipped", "out_for_delivery", "delivered"] as const;
const SHIPPING_OPTIONS = [
  { key: "standard" as const, label: "Standard", feeCents: 0, eta: "5-7 days" },
  { key: "express" as const, label: "Express", feeCents: 799, eta: "2-3 days" },
  { key: "priority" as const, label: "Priority", feeCents: 1499, eta: "1 day" },
];
const POINT_TO_CENT = 10;

export const StoreScreen = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [redeemPoints, setRedeemPoints] = useState("0");
  const [rewardBalance, setRewardBalance] = useState(0);
  const [shippingOption, setShippingOption] = useState<"standard" | "express" | "priority">("standard");
  const [shippingAddressLine1, setShippingAddressLine1] = useState("");
  const [shippingPostalCode, setShippingPostalCode] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingState, setShippingState] = useState("");
  const [shippingCountry, setShippingCountry] = useState("");
  const user = useAuthStore((s) => s.user);

  const currentOrder = useMemo(() => orders.find((order) => order.id === selectedOrderId), [orders, selectedOrderId]);
  const selectedProduct = useMemo(() => products.find((p) => p.id === selectedProductId), [products, selectedProductId]);

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([productId, quantity]) => {
          const product = products.find((p) => p.id === productId);
          return product ? { product, quantity } : null;
        })
        .filter(Boolean) as Array<{ product: Product; quantity: number }>,
    [cart, products],
  );

  const subtotalCents = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.product.priceCents * item.quantity, 0),
    [cartItems],
  );
  const shippingFeeCents = SHIPPING_OPTIONS.find((s) => s.key === shippingOption)?.feeCents ?? 0;
  const payableBeforeRedeemCents = subtotalCents + shippingFeeCents;
  const requestedPoints = Math.max(Number(redeemPoints) || 0, 0);
  const maxApplicablePoints = Math.floor(payableBeforeRedeemCents / POINT_TO_CENT);
  const appliedPoints = Math.min(requestedPoints, maxApplicablePoints, rewardBalance);
  const previewTotalCents = Math.max(payableBeforeRedeemCents - appliedPoints * POINT_TO_CENT, 0);

  const refreshCatalog = async () => {
    try {
      const [productRows, orderRows, reward] = await Promise.all([
        api.get<Product[]>("/api/store/products"),
        api.get<Order[]>("/api/store/orders"),
        api.get<{ points: number }>("/api/rewards/balance"),
      ]);
      setProducts(productRows);
      setOrders(orderRows);
      setRewardBalance(reward.points);
      if (!selectedOrderId && orderRows.length > 0) setSelectedOrderId(orderRows[0].id);
      if (!selectedProductId && productRows.length > 0) setSelectedProductId(productRows[0].id);
    } catch (error) {
      Alert.alert("Store load failed", String(error));
    }
  };

  const loadOrderEvents = async (orderId: string) => {
    try {
      const timeline = await api.get<OrderEvent[]>(`/api/store/orders/${orderId}/events`);
      setEvents(timeline);
      getSocket().emit("order:join", orderId);
    } catch {
      setEvents([]);
    }
  };

  useEffect(() => {
    refreshCatalog();
    const socket = getSocket();
    const handler = (incoming: { orderId: string; status: string; note?: string; createdAt: string }) => {
      if (incoming.orderId === selectedOrderId) {
        setEvents((previous) => [
          ...previous,
          { id: `${incoming.orderId}-${incoming.createdAt}`, status: incoming.status, note: incoming.note, createdAt: incoming.createdAt },
        ]);
      }
      setOrders((previous) => previous.map((order) => (order.id === incoming.orderId ? { ...order, status: incoming.status } : order)));
    };

    socket.on("order:status:update", handler);
    return () => socket.off("order:status:update", handler);
  }, [selectedOrderId]);

  useEffect(() => {
    if (selectedOrderId) loadOrderEvents(selectedOrderId);
  }, [selectedOrderId]);

  const updateQuantity = (productId: string, delta: number) => {
    setCart((previous) => {
      const nextQty = Math.max((previous[productId] ?? 0) + delta, 0);
      return { ...previous, [productId]: nextQty };
    });
  };

  const checkout = async () => {
    if (cartItems.length === 0) return Alert.alert("Cart is empty");
    if (!shippingAddressLine1 || !shippingPostalCode || !shippingCity || !shippingState || !shippingCountry) {
      Alert.alert("Shipping details missing", "Please fill complete shipping address.");
      return;
    }

    try {
      const response = await api.post<any>(
        "/api/store/orders",
        {
          items: cartItems.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
          redeemPoints: requestedPoints,
          shippingOption,
          shippingAddressLine1,
          shippingPostalCode,
          shippingCity,
          shippingState,
          shippingCountry,
        },
        { headers: { "idempotency-key": `${Date.now()}-${Math.random()}` } },
      );

      setCart({});
      setRedeemPoints("0");
      await refreshCatalog();

      if ((response?.redeemPointsUsed ?? 0) < requestedPoints) {
        Alert.alert("Reward points adjusted", `Applied ${response.redeemPointsUsed} points based on balance/total.`);
      }

      if (response?.checkout?.checkoutUrl) {
        await Linking.openURL(response.checkout.checkoutUrl);
        Alert.alert("Redirected to payment", "Complete payment in browser. Status updates will appear here.");
      } else if (response?.checkout?.sessionId) {
        Alert.alert("Payment session created", `Session: ${response.checkout.sessionId}`);
      } else {
        Alert.alert("Order placed", "Order confirmed.");
      }
    } catch (error) {
      Alert.alert("Checkout failed", String(error));
    }
  };

  const simulateShipping = async () => {
    if (!currentOrder || user?.role !== "admin") return;
    const index = SHIPPING_FLOW.findIndex((status) => status === currentOrder.status);
    const next = SHIPPING_FLOW[Math.min(index + 1, SHIPPING_FLOW.length - 1)];
    if (!next || next === currentOrder.status) return;

    try {
      await api.post(`/api/store/admin/orders/${currentOrder.id}/status`, { status: next, note: `Auto progression to ${next}` });
      await refreshCatalog();
    } catch (error) {
      Alert.alert("Could not update shipping", String(error));
    }
  };

  return (
    <Screen>
      <ScreenTitle title="Rider Commerce" subtitle={`Reward balance: ${rewardBalance} points`} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.section}>Catalog</Text>
        <FlatList
          horizontal
          data={products}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <SurfaceCard style={[styles.productCard, selectedProductId === item.id && styles.activeCard]}>
              {item.imageUrl ? <Image source={{ uri: `${item.imageUrl}?auto=format&fit=crop&w=600&q=70` }} style={styles.productImage} /> : null}
              <Text style={styles.productTitle}>{item.name}</Text>
              <Text style={styles.productDesc}>{item.description.slice(0, 70)}...</Text>
              <Text style={styles.productPrice}>${(item.priceCents / 100).toFixed(2)}</Text>
              <View style={styles.qtyRow}>
                <AppButton label="-" variant="secondary" onPress={() => updateQuantity(item.id, -1)} />
                <Text style={styles.qtyText}>{cart[item.id] ?? 0}</Text>
                <AppButton label="+" variant="secondary" onPress={() => updateQuantity(item.id, 1)} />
              </View>
              <AppButton label="View Details" variant="secondary" onPress={() => setSelectedProductId(item.id)} />
            </SurfaceCard>
          )}
        />

        {selectedProduct && (
          <SurfaceCard style={styles.detailCard}>
            <Text style={styles.sectionSmall}>Product Details</Text>
            <Text style={styles.productTitle}>{selectedProduct.name}</Text>
            <Text style={styles.productDesc}>{selectedProduct.description}</Text>
            <Text style={styles.productDesc}>Stock: {selectedProduct.stockQty}</Text>
            <Text style={styles.productPrice}>${(selectedProduct.priceCents / 100).toFixed(2)}</Text>
          </SurfaceCard>
        )}

        <SurfaceCard style={styles.checkoutPanel}>
          <Text style={styles.sectionSmall}>Shipping Address</Text>
          <AppInput value={shippingAddressLine1} onChangeText={setShippingAddressLine1} placeholder="Address line 1" />
          <View style={styles.row}>
            <AppInput value={shippingCity} onChangeText={setShippingCity} placeholder="City" style={styles.half} />
            <AppInput value={shippingState} onChangeText={setShippingState} placeholder="State" style={styles.half} />
          </View>
          <View style={styles.row}>
            <AppInput value={shippingPostalCode} onChangeText={setShippingPostalCode} placeholder="Postal code" style={styles.half} />
            <AppInput value={shippingCountry} onChangeText={setShippingCountry} placeholder="Country" style={styles.half} />
          </View>

          <Text style={styles.sectionSmall}>Shipping Option</Text>
          <View style={styles.rowWrap}>
            {SHIPPING_OPTIONS.map((option) => (
              <AppButton
                key={option.key}
                label={`${option.label} (${option.feeCents === 0 ? "Free" : `$${(option.feeCents / 100).toFixed(2)}`}, ${option.eta})`}
                variant={shippingOption === option.key ? "primary" : "secondary"}
                onPress={() => setShippingOption(option.key)}
                style={styles.optionBtn}
              />
            ))}
          </View>

          <Text style={styles.sectionSmall}>Rewards & Checkout</Text>
          <AppInput value={redeemPoints} onChangeText={setRedeemPoints} keyboardType="numeric" placeholder="Redeem reward points" />
          <Text style={styles.summaryText}>Cart subtotal: ${(subtotalCents / 100).toFixed(2)}</Text>
          <Text style={styles.summaryText}>Shipping fee: ${(shippingFeeCents / 100).toFixed(2)}</Text>
          <Text style={styles.summaryText}>Applied points: {appliedPoints} (-${((appliedPoints * POINT_TO_CENT) / 100).toFixed(2)})</Text>
          <Text style={styles.summaryTotal}>Payable total: ${(previewTotalCents / 100).toFixed(2)}</Text>
          <AppButton label="Checkout" onPress={checkout} />
        </SurfaceCard>

        <Text style={styles.section}>Your Orders</Text>
        <FlatList
          horizontal
          data={orders}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <SurfaceCard style={[styles.orderCard, selectedOrderId === item.id && styles.activeCard]}>
              <Text style={styles.orderTitle}>#{item.id.slice(0, 8)}</Text>
              <Text style={styles.productDesc}>Status: {item.status}</Text>
              <Text style={styles.productDesc}>Payment: {item.paymentStatus}</Text>
              <Text style={styles.productDesc}>Shipping: {item.shippingOption}</Text>
              <Text style={styles.productDesc}>Total: ${(item.totalCents / 100).toFixed(2)}</Text>
              <AppButton label="Track Shipping" variant="secondary" onPress={() => setSelectedOrderId(item.id)} />
            </SurfaceCard>
          )}
        />

        {currentOrder && (
          <SurfaceCard style={styles.timelinePanel}>
            <Text style={styles.timelineTitle}>Order Confirmation & Shipping</Text>
            <Text style={styles.summaryText}>
              Ship to: {currentOrder.shipping?.addressLine1}, {currentOrder.shipping?.city}, {currentOrder.shipping?.state},{" "}
              {currentOrder.shipping?.postalCode}, {currentOrder.shipping?.country}
            </Text>
            {events.map((event) => (
              <Text key={event.id} style={styles.timelineItem}>
                {new Date(event.createdAt).toLocaleString()} - {event.status} {event.note ? `(${event.note})` : ""}
              </Text>
            ))}
            {user?.role === "admin" && <AppButton label="Simulate Next Shipping Step" variant="secondary" onPress={simulateShipping} />}
          </SurfaceCard>
        )}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  section: { color: theme.colors.brand.primary, fontWeight: "800", marginBottom: theme.spacing.sm, marginTop: theme.spacing.md },
  sectionSmall: { color: theme.colors.brand.highlight, fontWeight: "800", marginBottom: theme.spacing.sm },
  productCard: { width: 270, marginRight: theme.spacing.sm, backgroundColor: theme.colors.background.elevated },
  detailCard: { marginTop: theme.spacing.sm },
  productImage: { width: "100%", height: 130, borderRadius: theme.radius.md, marginBottom: theme.spacing.sm, backgroundColor: theme.colors.background.tertiary },
  activeCard: { borderColor: theme.colors.brand.primary },
  productTitle: { color: theme.colors.text.primary, fontWeight: "800" },
  productDesc: { color: theme.colors.text.secondary, fontSize: 13, marginTop: 4 },
  productPrice: { color: theme.colors.brand.highlight, fontWeight: "800", marginTop: 8 },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  qtyText: { color: theme.colors.text.primary, fontWeight: "800", fontSize: 16 },
  checkoutPanel: { marginTop: theme.spacing.md },
  row: { flexDirection: "row", gap: theme.spacing.sm },
  half: { flex: 1 },
  rowWrap: { gap: theme.spacing.sm },
  optionBtn: { width: "100%" },
  summaryText: { color: theme.colors.text.secondary, marginTop: 2 },
  summaryTotal: { color: theme.colors.text.primary, fontWeight: "900", marginTop: theme.spacing.xs, marginBottom: theme.spacing.sm },
  orderCard: { width: 250, marginRight: theme.spacing.sm },
  orderTitle: { color: theme.colors.text.primary, fontWeight: "800" },
  timelinePanel: { marginTop: theme.spacing.md, marginBottom: theme.spacing.lg },
  timelineTitle: { color: theme.colors.brand.highlight, fontWeight: "800", marginBottom: 8 },
  timelineItem: { color: theme.colors.text.primary, marginBottom: 6, fontSize: 13 },
});
