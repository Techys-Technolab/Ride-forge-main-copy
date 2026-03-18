# Vercel Dashboard Setup Checklist

Use this when creating the Vercel project for Rideforge.

## 1. Import project

1. Open Vercel Dashboard.
2. Click `Add New` -> `Project`.
3. Import the repository or upload the corrected project.

## 2. Configure root directory

1. In project settings, set `Root Directory` to `apps/server`.
2. Confirm the detected framework is `Other`.

## 3. Build settings

1. Confirm `Install Command`:
   `cd ../.. && npm install --workspace @rideforge/shared --workspace @rideforge/server`
2. Confirm `Build Command`:
   `cd ../.. && npm run build --workspace @rideforge/shared --workspace @rideforge/server`
3. Leave output directory empty for the API project.

## 4. Runtime settings

1. Set Node.js runtime to `20.x`.
2. Disable any legacy incompatible runtime options if present.

## 5. Environment variables

1. Open `Settings` -> `Environment Variables`.
2. Add all required keys from `docs/VERCEL_ENV_KEYS.md`.
3. Add them for:
   - Production
   - Preview
   - Development, if you use Vercel dev

## 6. Database and Redis

1. Ensure your hosted PostgreSQL instance is reachable from Vercel.
2. Ensure your hosted Redis instance is reachable from Vercel.
3. Apply SQL schema and migrations before first production traffic.

## 7. Webhooks

1. Configure Stripe/Razorpay webhook URLs if payments are enabled.
2. Use the deployed Vercel URL:
   - `/api/subscriptions/webhook`
   - `/api/store/webhook`

## 8. Deploy

1. Click `Deploy`.
2. Wait for build to finish.
3. Open:
   - `/health`
4. Confirm response:
   - `{"status":"ok","service":"rideforge-api"}`

## 9. Post-deploy smoke checks

1. Test auth signup/login endpoints.
2. Test one protected API with bearer token.
3. Test notifications device-token registration.
4. Test one payment webhook in sandbox.

## 10. Important limitation

This Vercel deployment covers the HTTP API path. For Socket.IO realtime features, deploy a separate long-lived Node service using `infra/docker/server.Dockerfile` or the compose file in `infra/docker/realtime-compose.yml`.
