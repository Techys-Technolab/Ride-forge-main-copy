import { Alert, Linking } from "react-native";

function normalizePhone(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  return hasPlus ? `+${digits}` : digits;
}

export async function shareLocationOnWhatsApp(input: {
  latitude: number;
  longitude: number;
  label?: string;
  phone?: string;
}): Promise<void> {
  const mapsUrl = `https://maps.google.com/?q=${input.latitude},${input.longitude}`;
  const message = `${input.label ?? "My live location"}: ${mapsUrl}`;
  const phone = normalizePhone(input.phone);
  const phoneParam = phone ? `&phone=${encodeURIComponent(phone)}` : "";
  const whatsappDeepLink = `whatsapp://send?text=${encodeURIComponent(message)}${phoneParam}`;
  const whatsappWebLink = phone
    ? `https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  try {
    const canOpenApp = await Linking.canOpenURL(whatsappDeepLink);
    if (canOpenApp) {
      await Linking.openURL(whatsappDeepLink);
      return;
    }
    await Linking.openURL(whatsappWebLink);
  } catch (error) {
    Alert.alert("Location share failed", String(error));
  }
}
