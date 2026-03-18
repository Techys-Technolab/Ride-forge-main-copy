# Rideforge - Production-Ready Motorcycle Riding Platform

Rideforge is a full-stack rider platform built from your product requirements:
- Expo React Native mobile app with creative rider-first UI
- Node.js/Express TypeScript backend
- JWT auth with OAuth-ready endpoints
- GPS ride logging, route studio, online/offline map pack flow
- GPS ride logging with real-distance calculation and ride history summary
- Personal chat + group chat + local rider help request network
- Ecommerce store with online order placement and live shipping updates
- Rewards engine: points from ride completion and challenge completion
- Ride rewards enforced at `1 point per 100 km` with cumulative carry-over
- Points redemption in store checkout
- PostgreSQL persistence + Redis caching/session storage
- Payment provider abstraction: Stripe, Razorpay, RevenueCat
- Real-time events via Socket.IO
- Firebase push pipeline for chat/order notifications
- WhatsApp location sharing (manual + safety auto-share while riding)
- Dual onboarding: Rider and Riding Club registration with OTP verification
- Club directory, membership requests, and admin approval workflows
- OTP delivery providers: Twilio (SMS) + SendGrid (email)

## Monorepo Structure

- `apps/mobile`: Expo React Native application
- `apps/server`: Express API + Socket.IO server
- `packages/shared`: Shared TypeScript contracts
- `docs/RELEASE_CHECKLIST.md`: Concrete go-live checklist
- `docs/FIREBASE_SETUP.md`: Firebase server/mobile setup
- `docs/DB_MIGRATION_CHECK.md`: Existing DB migration + verification commands
- `docs/NOTIFICATION_EVENTS.md`: Push notification event coverage matrix
- `docs/VERCEL_ENV_KEYS.md`: Vercel environment variable checklist
- `docs/VERCEL_ENV_BLOCK.md`: Ready-to-paste Vercel env block
- `docs/VERCEL_DASHBOARD_CHECKLIST.md`: Step-by-step Vercel setup flow
- `docs/REALTIME_DEPLOYMENT.md`: Separate Socket.IO deployment guidance
- `docs/FINAL_DEPLOYMENT_ORDER.md`: One-page rollout order
- `infra/sql/schema.sql`: PostgreSQL schema
- `infra/docker`: Docker and compose setup
- `render.yaml`: Render realtime deployment config
- `railway.json`: Railway realtime deployment config
- `.github/workflows/ci.yml`: CI pipeline

## Deployment

- Vercel API deployment: `docs/DEPLOYMENT.md`
- Vercel env list: `docs/VERCEL_ENV_KEYS.md`
- Vercel env block: `docs/VERCEL_ENV_BLOCK.md`
- Vercel dashboard setup: `docs/VERCEL_DASHBOARD_CHECKLIST.md`
- Realtime Socket.IO deployment: `docs/REALTIME_DEPLOYMENT.md`
- Final rollout order: `docs/FINAL_DEPLOYMENT_ORDER.md`
- Firebase setup: `docs/FIREBASE_SETUP.md`
