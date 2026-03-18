import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "change-me-in-production",
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  databaseUrl: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/rideforge",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  paymentProvider: (process.env.PAYMENT_PROVIDER ?? "stripe") as "stripe" | "razorpay" | "revenuecat",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
  revenueCatApiKey: process.env.REVENUECAT_API_KEY,
  checkoutSuccessUrl: process.env.CHECKOUT_SUCCESS_URL ?? "https://example.com/payment/success",
  checkoutCancelUrl: process.env.CHECKOUT_CANCEL_URL ?? "https://example.com/payment/cancel",
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY,
  firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
  firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
  sendgridApiKey: process.env.SENDGRID_API_KEY,
  sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL,
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  twilioFromPhone: process.env.TWILIO_FROM_PHONE,
  otpProviderMode: (process.env.OTP_PROVIDER_MODE ?? "log") as "log" | "live",
  otpExposeDevCodes: (process.env.OTP_EXPOSE_DEV_CODES ?? "true").toLowerCase() === "true",
  otpRequireLiveProviders:
    (process.env.OTP_REQUIRE_LIVE_PROVIDERS ?? (process.env.NODE_ENV === "production" ? "true" : "false")).toLowerCase() ===
    "true",
};
