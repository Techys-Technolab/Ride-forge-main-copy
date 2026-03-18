# Final Deployment Order

Use this order for the cleanest production rollout.

## 1. Prepare infrastructure

1. Provision PostgreSQL.
2. Provision Redis.
3. Confirm external DB and Redis network access from both hosts.

## 2. Apply database schema and migrations

1. Apply `infra/sql/schema.sql` on a fresh DB, or
2. Apply:
   - `infra/sql/migrations/2026-02-21_existing_db_patch.sql`
   - `infra/sql/migrations/2026-02-22_signup_clubs_onboarding.sql`
   - `infra/sql/migrations/2026-02-23_password_reset_codes.sql`

## 3. Deploy the Vercel HTTP API

1. Create a Vercel project.
2. Set Root Directory to `apps/server`.
3. Add environment variables from:
   - `docs/VERCEL_ENV_KEYS.md`
   - `docs/VERCEL_ENV_BLOCK.md`
4. Deploy.
5. Verify:
   - `GET /health`

## 4. Deploy the realtime host

Choose one:

- Render:
  - use `render.yaml`
- Railway:
  - use `railway.json`
- Docker:
  - use `infra/docker/realtime-compose.yml`

Then:

1. Add the same production env keys.
2. Start the service.
3. Verify:
   - `GET /health`

## 5. Point clients to the correct backend

1. Set `EXPO_PUBLIC_API_URL` to the deployed backend base URL.
2. If you keep HTTP and realtime on different hosts, make sure the app uses the correct host strategy before go-live.

## 6. Configure Firebase and OTP

1. Add Firebase service account secret:
   - `FIREBASE_SERVICE_ACCOUNT_JSON` on hosted environments
2. Add SendGrid and Twilio production credentials.
3. Confirm:
   - signup OTP works
   - forgot password works
   - push delivery works

## 7. Configure payments

1. Add Stripe/Razorpay/RevenueCat credentials.
2. Register webhook URLs on the live provider.
3. Verify one sandbox payment end-to-end.

## 8. Smoke test before release

1. Signup rider
2. Verify OTP
3. Login
4. Update profile
5. Create or browse club
6. Send chat message
7. Test push notification
8. Test store checkout

## 9. Release gate

1. Complete `docs/Release-Signoff-Matrix.xlsx`
2. Confirm no Sev1/Sev2 blockers remain
3. Release traffic

## 10. Post-release monitoring

1. Watch `/health`
2. Watch logs for:
   - DB connection failures
   - Redis failures
   - OTP delivery failures
   - push failures
   - payment webhook failures
   - websocket disconnect spikes
