-- Idempotent patch migration for existing Rideforge databases.
-- Safe to run multiple times.

ALTER TABLE users ADD COLUMN IF NOT EXISTS ride_distance_total_km NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ride_reward_km_remainder NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE events ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'event';
ALTER TABLE events ADD COLUMN IF NOT EXISTS description TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'events_kind_check'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_kind_check CHECK (kind IN ('ride', 'event'));
  END IF;
END $$;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal_cents INT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee_cents INT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_option TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address_line1 TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_postal_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_session_id
  ON orders(payment_session_id)
  WHERE payment_session_id IS NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'rider';
ALTER TABLE users ADD COLUMN IF NOT EXISTS rider_member_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS club_member_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_status TEXT NOT NULL DEFAULT 'pending_verification';
ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_account_type_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_account_type_check CHECK (account_type IN ('rider', 'club'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_onboarding_status_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_onboarding_status_check CHECK (onboarding_status IN ('pending_verification', 'active', 'suspended'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'users_username_key'
  ) THEN
    CREATE UNIQUE INDEX users_username_key ON users (username);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'users_phone_key'
  ) THEN
    CREATE UNIQUE INDEX users_phone_key ON users (phone);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'users_rider_member_code_key'
  ) THEN
    CREATE UNIQUE INDEX users_rider_member_code_key ON users (rider_member_code);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'users_club_member_code_key'
  ) THEN
    CREATE UNIQUE INDEX users_club_member_code_key ON users (club_member_code);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS rider_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  blood_group TEXT NOT NULL,
  emergency_contact_name TEXT NOT NULL,
  emergency_contact_phone TEXT NOT NULL,
  bike_models TEXT[] NOT NULL DEFAULT '{}',
  club_name TEXT,
  is_solo_rider BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clubs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_code TEXT UNIQUE NOT NULL,
  club_name TEXT UNIQUE NOT NULL,
  club_username TEXT UNIQUE NOT NULL,
  admin_name TEXT NOT NULL,
  about TEXT NOT NULL,
  logo_url TEXT,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL,
  facebook_url TEXT,
  instagram_url TEXT,
  identity_verification_status TEXT NOT NULL DEFAULT 'pending',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clubs_identity_verification_status_check'
  ) THEN
    ALTER TABLE clubs ADD CONSTRAINT clubs_identity_verification_status_check CHECK (identity_verification_status IN ('pending', 'verified', 'rejected'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS club_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'moderator', 'member')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  review_note TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_id, user_id)
);

CREATE TABLE IF NOT EXISTS verification_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'phone')),
  target TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ NOT NULL,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, channel)
);

CREATE TABLE IF NOT EXISTS id_counters (
  id_type TEXT NOT NULL,
  seq_year INT NOT NULL,
  next_value INT NOT NULL DEFAULT 1,
  PRIMARY KEY (id_type, seq_year)
);
