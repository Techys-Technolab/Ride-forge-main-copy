# Vercel Environment Keys

Set these variables in the Vercel project for `apps/server`.

## Required

```env
PORT=4000
JWT_SECRET=replace-with-a-long-random-secret
CORS_ORIGIN=https://your-frontend-domain.com
DATABASE_URL=postgres://user:password@host:5432/rideforge
REDIS_URL=redis://host:6379
```

## Payments

Choose the provider you actually use.

```env
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
CHECKOUT_SUCCESS_URL=https://your-domain.com/payment/success
CHECKOUT_CANCEL_URL=https://your-domain.com/payment/cancel
```

```env
PAYMENT_PROVIDER=razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
CHECKOUT_SUCCESS_URL=https://your-domain.com/payment/success
CHECKOUT_CANCEL_URL=https://your-domain.com/payment/cancel
```

```env
PAYMENT_PROVIDER=revenuecat
REVENUECAT_API_KEY=
CHECKOUT_SUCCESS_URL=https://your-domain.com/payment/success
CHECKOUT_CANCEL_URL=https://your-domain.com/payment/cancel
```

## OTP / Signup Verification

```env
OTP_PROVIDER_MODE=live
OTP_EXPOSE_DEV_CODES=false
OTP_REQUIRE_LIVE_PROVIDERS=true
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_PHONE=
```

## Firebase Push

Recommended on Vercel:

```env
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"ride-forge-app",...}
```

Alternative split vars:

```env
FIREBASE_PROJECT_ID=ride-forge-app
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxx@ride-forge-app.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Do not use `FIREBASE_SERVICE_ACCOUNT_PATH` on Vercel.

## Recommended production values

```env
NODE_ENV=production
OTP_PROVIDER_MODE=live
OTP_EXPOSE_DEV_CODES=false
OTP_REQUIRE_LIVE_PROVIDERS=true
```

## Mobile / frontend API connection

Your client should point to the deployed backend:

```env
EXPO_PUBLIC_API_URL=https://your-vercel-project.vercel.app
```

## Notes

- Set the Vercel project Root Directory to `apps/server`.
- Realtime Socket.IO is not fully supported by the Vercel serverless function model in this repo.
- Use a separate long-lived host for websocket-heavy features.
