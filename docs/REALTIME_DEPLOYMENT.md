# Realtime Deployment for Socket.IO

Use this deployment when you want persistent websocket support for:

- chat
- live ride telemetry
- live order/shipping updates
- other Socket.IO-driven events

## Recommended hosting targets

- Cloud Run
- Render
- Railway
- ECS/Fargate
- a VM with Docker

## Why separate from Vercel

The current Vercel setup is suitable for the HTTP API layer. Socket.IO in this codebase expects a long-lived Node process and shared Redis/Postgres access, which is better handled on a non-serverless host.

## Files

- Server image: `infra/docker/server.Dockerfile`
- Compose example: `infra/docker/realtime-compose.yml`
- Render config: `render.yaml`
- Railway config: `railway.json`

## Required env vars

Use the same core env as the API:

```env
PORT=4000
JWT_SECRET=
CORS_ORIGIN=
DATABASE_URL=
REDIS_URL=
PAYMENT_PROVIDER=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
REVENUECAT_API_KEY=
CHECKOUT_SUCCESS_URL=
CHECKOUT_CANCEL_URL=
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_PHONE=
OTP_PROVIDER_MODE=live
OTP_EXPOSE_DEV_CODES=false
OTP_REQUIRE_LIVE_PROVIDERS=true
FIREBASE_SERVICE_ACCOUNT_JSON=
```

## Render

1. Create a new Web Service in Render.
2. Connect the repository.
3. Render will detect `render.yaml`.
4. Add all secret env vars that are marked `sync: false`.
5. Deploy and confirm `/health`.

## Railway

1. Create a new project in Railway.
2. Deploy from the repository.
3. Railway will use `railway.json`.
4. Add the same env vars in the Railway variables tab.
5. Deploy and confirm `/health`.

## Docker Compose

```powershell
Set-Location "C:\Users\ADMIN\Downloads\Ride-forge-main - Copy\Ride-forge-main - Copy\infra\docker"
docker compose -f realtime-compose.yml up --build -d
```

## Client connection

Point websocket clients to the realtime host URL.

Example:

```env
EXPO_PUBLIC_API_URL=https://rideforge-realtime.yourdomain.com
```

If you split HTTP API and realtime hosts, keep the mobile app aligned with the host that serves both HTTP and websocket traffic or add a separate realtime base URL in a later pass.
