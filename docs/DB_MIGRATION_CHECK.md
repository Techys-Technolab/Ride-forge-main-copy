# DB Migration + Health Check (Existing Databases)

Use this when your PostgreSQL database already exists and you need to apply the latest schema changes safely.

## 1) Apply migration

```powershell
Set-Location "C:\Users\ADMIN\Downloads\Bike riding app\Code-final-uiux-v2"
psql "$env:DATABASE_URL" -f "infra/sql/migrations/2026-02-21_existing_db_patch.sql"
psql "$env:DATABASE_URL" -f "infra/sql/migrations/2026-02-22_signup_clubs_onboarding.sql"
psql "$env:DATABASE_URL" -f "infra/sql/migrations/2026-02-23_password_reset_codes.sql"
```

If `DATABASE_URL` is not set in shell:

```powershell
psql "postgres://postgres:postgres@localhost:5432/rideforge" -f "infra/sql/migrations/2026-02-21_existing_db_patch.sql"
psql "postgres://postgres:postgres@localhost:5432/rideforge" -f "infra/sql/migrations/2026-02-22_signup_clubs_onboarding.sql"
psql "postgres://postgres:postgres@localhost:5432/rideforge" -f "infra/sql/migrations/2026-02-23_password_reset_codes.sql"
```

## 2) Verify required columns/tables

```powershell
psql "$env:DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name IN ('ride_distance_total_km','ride_reward_km_remainder') ORDER BY column_name;"
psql "$env:DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name IN ('username','phone','account_type','rider_member_code','club_member_code','is_email_verified','is_phone_verified','onboarding_status','country') ORDER BY column_name;"
psql "$env:DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name='events' AND column_name IN ('kind','description') ORDER BY column_name;"
psql "$env:DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name IN ('subtotal_cents','shipping_fee_cents','shipping_option','shipping_address_line1','shipping_postal_code') ORDER BY column_name;"
psql "$env:DATABASE_URL" -c "SELECT to_regclass('public.user_device_tokens') AS user_device_tokens_table;"
psql "$env:DATABASE_URL" -c "SELECT to_regclass('public.rider_profiles') AS rider_profiles, to_regclass('public.clubs') AS clubs, to_regclass('public.club_memberships') AS club_memberships, to_regclass('public.verification_codes') AS verification_codes, to_regclass('public.id_counters') AS id_counters;"
psql "$env:DATABASE_URL" -c "SELECT to_regclass('public.password_reset_codes') AS password_reset_codes;"
```

## 3) Verify DB runtime health

```powershell
psql "$env:DATABASE_URL" -c "SELECT NOW() AS db_time, COUNT(*) AS users_count FROM users;"
```

## 4) Verify API health and DB path

After starting server:

```powershell
Invoke-WebRequest -Uri "http://localhost:4000/health" -UseBasicParsing | Select-Object -ExpandProperty Content
```

Expected:
- JSON with `"status":"ok"`

## 5) Redis health quick check

If `redis-cli` is installed:

```powershell
redis-cli -u "$env:REDIS_URL" PING
```

Expected:
- `PONG`

If `redis-cli` is unavailable, check server logs after startup:
- `Redis connected` means Redis path is healthy.
- `Redis unavailable... in-memory fallback` means app can run but Redis-based features are degraded.
