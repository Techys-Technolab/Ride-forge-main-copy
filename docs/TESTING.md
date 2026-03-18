# Test Plan

## Backend

- Auth lifecycle: signup/login/refresh/oauth
- Ride lifecycle: start/stop/list/history-summary + reward accrual (1 point per 100km cumulative)
- Route lifecycle: create/list/favorites
- Chat: personal + group conversation creation, messaging, local help flows
- Challenges: list dynamic challenges, complete once, reward grant
- Store: product list, order create, points redemption, shipping status timeline
- Store: product details view, cart totals, shipping address + option selection, checkout and order confirmation payload
- Payments: checkout session creation + webhook signature verification
- Maps: offline pack create/list and map manifest retrieval
- Notifications: device token register/unregister and Firebase test push
- Notifications: validate chat/store/rides/challenges/events/help-request push messages and foreground display behavior
- Ride & Events: create ride/event listings, express interest, contact creator (in-app chat conversation)
- OTP: verify email OTP via SendGrid and phone OTP via Twilio for signup + resend paths
- Forgot Password: request reset OTP and confirm password reset, then login with new password
- Auth/Profile push: validate `profile_created`, `profile_updated`, `profile_update_failed` (server failure), `auth_account_verified`, `auth_login_success`, `auth_password_changed`, `profile_system_change`
- Profile: verify `/api/profile/me/summary`, `/api/profile/me/details`, and role-specific update endpoints (`/api/profile/me/rider`, `/api/profile/me/club`)

## Mobile

- Auth + persisted session
- Ride tracker stop flow and reward alert
- Map mode switch online/offline and offline pack manager
- Ride tracker live GPS updates, distance accuracy, and historical totals in UI
- Chat UX including help request response path
- Store UX including cart, checkout, live order status updates
- Challenge completion and rewards ledger rendering

## Performance

- Load test `/api/chat/conversations/:id/messages` and `/api/store/orders`
- Validate websocket fan-out for chat and order updates

## Security

- JWT validation and guarded endpoints
- Rate-limit behavior (`429`) for abuse scenarios
- Idempotency enforcement for order creation
- Payment webhook signature validation
