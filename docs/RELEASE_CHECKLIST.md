# Release Checklist (Deploy-Ready)

## P0 - Blocking Before Production

- [ ] Run `npm install` and fix dependency/audit issues.
- [ ] Provision production PostgreSQL + Redis with backups and retention policy.
- [ ] Apply `infra/sql/schema.sql` to production DB.
- [ ] Set all production env vars from `apps/server/.env.example`.
- [ ] Configure `JWT_SECRET` as high-entropy secret in secret manager.
- [ ] Configure payment provider secrets and webhook URLs.
- [ ] Configure Firebase Admin secrets (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`).
- [ ] Verify Stripe/Razorpay webhook signatures end-to-end in staging for both `/api/subscriptions/webhook` and `/api/store/webhook`.
- [ ] Verify push delivery via `/api/notifications/test` on physical Android/iOS devices.
- [ ] Configure TLS, HTTPS redirect, and secure reverse proxy.
- [ ] Configure CORS allowlist for production app domains only.
- [ ] Execute backend test suite and add failing-case fixes.
- [ ] Run smoke tests for login, ride completion, rewards accrual, order checkout, chat messaging.

## P1 - Reliability and Security Hardening

- [ ] Enable DB migration tooling (Prisma/Knex/Drizzle) instead of raw schema-only flow.
- [ ] Add Redis + DB health probes for readiness/liveness.
- [ ] Add structured logging with trace/request IDs.
- [ ] Add alerting for 5xx rate, latency, DB saturation, Redis failures.
- [ ] Add idempotency key enforcement on all payment/order write endpoints.
- [ ] Add replay protection storage for payment webhooks.
- [ ] Add role-based authorization for admin-only order status transitions.
- [ ] Add anti-abuse checks on chat/help request creation.
- [ ] Add object storage + signed upload flow for social media uploads.

## P2 - Mobile Release Quality

- [ ] Validate Android/iOS permissions and privacy strings.
- [ ] Test map online/offline experience on real devices and low-connectivity conditions.
- [ ] Test chat and order tracking websocket reconnect behavior.
- [ ] Test challenge completion and reward redemption edge cases.
- [ ] Configure crash reporting and performance monitoring in mobile builds.
- [ ] Complete App Store/Play Store policy and billing compliance checks.

## P3 - Go-Live Runbook

- [ ] Blue/green or canary deploy plan documented.
- [ ] Rollback command path tested.
- [ ] Incident contacts and on-call escalation documented.
- [ ] Post-release verification checklist executed.
- [ ] 24-hour post-release monitoring window staffed.
