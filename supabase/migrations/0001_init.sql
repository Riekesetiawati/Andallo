-- Andallo relational schema, constraints, and row level security.
-- Apply on PostgreSQL 16 with PostGIS. Safe to run on Supabase.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

-- Identity helpers. On Supabase, auth.uid() wins when a user JWT is present.
-- The Next.js server sets app.user_id and app.role per transaction.

CREATE OR REPLACE FUNCTION app_uid() RETURNS uuid
LANGUAGE plpgsql STABLE AS $$
DECLARE
  uid uuid;
BEGIN
  IF to_regprocedure('auth.uid()') IS NOT NULL THEN
    EXECUTE 'SELECT auth.uid()' INTO uid;
    IF uid IS NOT NULL THEN
      RETURN uid;
    END IF;
  END IF;
  RETURN NULLIF(current_setting('app.user_id', true), '')::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULLIF(current_setting('app.user_id', true), '')::uuid;
END $$;

CREATE OR REPLACE FUNCTION app_role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.role', true), ''), 'anon')
$$;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  phone text,
  password_hash text,
  role text NOT NULL CHECK (role IN ('customer', 'provider', 'admin')),
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 3 AND 120),
  avatar_url text,
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  terms_accepted_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_email_unique UNIQUE (email),
  CONSTRAINT profiles_phone_unique UNIQUE (phone)
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE email_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE phone_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_email_idx ON login_attempts (email, created_at DESC);

CREATE TABLE app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (char_length(name) BETWEEN 3 AND 60),
  slug text NOT NULL UNIQUE,
  icon text NOT NULL DEFAULT 'sparkles',
  image_url text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE provider_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  business_name text NOT NULL CHECK (char_length(business_name) BETWEEN 2 AND 120),
  description text NOT NULL DEFAULT '',
  category_id uuid REFERENCES categories(id),
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  lat double precision,
  lng double precision,
  location geography(Point, 4326),
  service_radius_km numeric(6,1) NOT NULL DEFAULT 10 CHECK (service_radius_km > 0 AND service_radius_km <= 100),
  cover_url text,
  phone text,
  business_email text,
  service_method text NOT NULL DEFAULT 'BOTH' CHECK (service_method IN ('HOME_SERVICE', 'AT_PROVIDER', 'BOTH')),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED')),
  operating_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  social jsonb NOT NULL DEFAULT '{}'::jsonb,
  document_url text,
  identity_url text,
  rejection_note text,
  verified_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX provider_profiles_location_idx ON provider_profiles USING GIST (location);
CREATE INDEX provider_profiles_status_idx ON provider_profiles (status) WHERE deleted_at IS NULL;
CREATE INDEX provider_profiles_city_idx ON provider_profiles (city);

CREATE TABLE provider_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text NOT NULL DEFAULT '',
  reviewed_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id),
  name text NOT NULL CHECK (char_length(name) BETWEEN 3 AND 120),
  slug text NOT NULL,
  description text NOT NULL DEFAULT '',
  min_price int NOT NULL CHECK (min_price >= 0),
  max_price int NOT NULL CHECK (max_price >= min_price),
  duration_min int NOT NULL DEFAULT 60 CHECK (duration_min > 0 AND duration_min <= 1440),
  service_method text NOT NULL DEFAULT 'BOTH' CHECK (service_method IN ('HOME_SERVICE', 'AT_PROVIDER', 'BOTH')),
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, slug)
);
CREATE INDEX services_category_idx ON services (category_id) WHERE archived_at IS NULL;
CREATE INDEX services_provider_idx ON services (provider_id);

CREATE TABLE service_price_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  description text NOT NULL DEFAULT '',
  price int NOT NULL CHECK (price >= 0),
  duration_min int NOT NULL DEFAULT 60 CHECK (duration_min > 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX packages_service_idx ON service_price_packages (service_id);

CREATE TABLE portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  image_url text NOT NULL,
  caption text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX portfolios_provider_idx ON portfolios (provider_id, sort_order);

CREATE TABLE provider_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  weekday int NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (provider_id, weekday)
);

CREATE TABLE provider_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_holder text NOT NULL,
  evidence_url text,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  review_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------

CREATE SEQUENCE booking_code_seq START 2401;

CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES profiles(id),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id),
  service_id uuid NOT NULL REFERENCES services(id),
  package_id uuid NOT NULL REFERENCES service_price_packages(id),
  booking_date date NOT NULL,
  time_slot text NOT NULL,
  status text NOT NULL DEFAULT 'WAITING_APPROVAL' CHECK (status IN (
    'WAITING_APPROVAL', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONFIRMED',
    'PROVIDER_ON_THE_WAY', 'ARRIVED', 'ON_PROGRESS', 'COMPLETED',
    'CANCELLED', 'DISPUTED', 'REFUNDED'
  )),
  amount int NOT NULL CHECK (amount >= 0),
  address text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  service_method text NOT NULL DEFAULT 'HOME_SERVICE',
  approval_expires_at timestamptz,
  location_sharing boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bookings_customer_idx ON bookings (customer_id, created_at DESC);
CREATE INDEX bookings_provider_idx ON bookings (provider_id, booking_date, time_slot);
CREATE INDEX bookings_status_idx ON bookings (status, created_at DESC);
CREATE UNIQUE INDEX bookings_slot_unique ON bookings (provider_id, booking_date, time_slot)
  WHERE status IN (
    'WAITING_APPROVAL', 'ACCEPTED', 'CONFIRMED',
    'PROVIDER_ON_THE_WAY', 'ARRIVED', 'ON_PROGRESS'
  );

CREATE TABLE booking_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text NOT NULL DEFAULT '',
  actor_id uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX booking_history_idx ON booking_status_history (booking_id, created_at);

CREATE TABLE booking_cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  cancelled_by uuid NOT NULL REFERENCES profiles(id),
  cancelled_by_role text NOT NULL,
  reason text NOT NULL,
  note text NOT NULL DEFAULT '',
  cancelled_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  amount int NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PAID', 'REFUNDED')),
  method text NOT NULL DEFAULT 'CASH',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Chat, reviews, complaints, notifications, location
-- ---------------------------------------------------------------------------

CREATE TABLE chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_thread_idx ON chat_messages (thread_id, created_at);

CREATE TABLE chat_presence (
  thread_id uuid NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  typing_until timestamptz,
  PRIMARY KEY (thread_id, user_id)
);

CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES profiles(id),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id),
  service_id uuid NOT NULL REFERENCES services(id),
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '',
  hidden_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_provider_idx ON reviews (provider_id) WHERE hidden_at IS NULL;

CREATE TABLE review_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  opened_by uuid NOT NULL REFERENCES profiles(id),
  against_role text NOT NULL CHECK (against_role IN ('customer', 'provider')),
  category text NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 4 AND 140),
  description text NOT NULL CHECK (char_length(description) >= 10),
  expected_solution text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'NEED_MORE_INFO', 'RESOLVED', 'REJECTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX complaints_booking_idx ON complaints (booking_id);

CREATE TABLE complaint_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE complaint_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);

CREATE TABLE provider_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX provider_locations_booking_idx ON provider_locations (booking_id, recorded_at DESC);

CREATE TABLE favorites (
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, provider_id)
);

CREATE TABLE comparisons (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, service_id)
);

CREATE TABLE highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  headline text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  banner_url text,
  cta_label text NOT NULL DEFAULT 'Lihat mitra',
  sort_order int NOT NULL DEFAULT 0,
  start_at timestamptz,
  end_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE homepage_carousels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  image_url text NOT NULL,
  link text NOT NULL DEFAULT '/jasa',
  provider_id uuid REFERENCES provider_profiles(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  start_at timestamptz,
  end_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES profiles(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);

CREATE TABLE support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL CHECK (char_length(message) >= 10),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public_name(uid uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT full_name FROM profiles WHERE id = uid
$$;

CREATE OR REPLACE FUNCTION my_provider_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM provider_profiles WHERE user_id = app_uid() AND deleted_at IS NULL LIMIT 1
$$;

CREATE OR REPLACE FUNCTION notify_user(
  p_user uuid, p_type text, p_title text, p_message text, p_entity text, p_entity_id uuid
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
  VALUES (p_user, p_type, p_title, p_message, p_entity, p_entity_id);
$$;

CREATE OR REPLACE FUNCTION sync_provider_location() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER provider_profiles_location
  BEFORE INSERT OR UPDATE OF lat, lng ON provider_profiles
  FOR EACH ROW EXECUTE FUNCTION sync_provider_location();

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER categories_touch BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER provider_touch BEFORE UPDATE ON provider_profiles FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER services_touch BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER packages_touch BEFORE UPDATE ON service_price_packages FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER banks_touch BEFORE UPDATE ON provider_bank_accounts FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER bookings_touch BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER payments_touch BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER complaints_touch BEFORE UPDATE ON complaints FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER highlights_touch BEFORE UPDATE ON highlights FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER carousels_touch BEFORE UPDATE ON homepage_carousels FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Booking integrity and slot lock.
CREATE OR REPLACE FUNCTION guard_booking_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pkg_price int;
  svc_provider uuid;
  provider_status text;
  provider_user uuid;
  customer_verified timestamptz;
  require_phone boolean;
  phone_ok timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.provider_id::text || NEW.booking_date::text || NEW.time_slot));

  SELECT price, service_id INTO pkg_price, svc_provider FROM service_price_packages WHERE id = NEW.package_id;
  IF pkg_price IS NULL THEN
    RAISE EXCEPTION 'Paket tidak ditemukan.';
  END IF;
  SELECT provider_id INTO svc_provider FROM services WHERE id = NEW.service_id AND archived_at IS NULL AND is_active;
  IF svc_provider IS NULL OR svc_provider <> NEW.provider_id THEN
    RAISE EXCEPTION 'Jasa tidak sesuai dengan mitra.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM service_price_packages WHERE id = NEW.package_id AND service_id = NEW.service_id AND is_active) THEN
    RAISE EXCEPTION 'Paket tidak aktif untuk jasa ini.';
  END IF;

  SELECT status, user_id INTO provider_status, provider_user FROM provider_profiles WHERE id = NEW.provider_id AND deleted_at IS NULL;
  IF provider_status IS DISTINCT FROM 'VERIFIED' THEN
    RAISE EXCEPTION 'Mitra ini belum terverifikasi.';
  END IF;

  SELECT email_verified_at, phone_verified_at INTO customer_verified, phone_ok FROM profiles WHERE id = NEW.customer_id;
  IF customer_verified IS NULL AND app_role() <> 'system' THEN
    RAISE EXCEPTION 'Verifikasi email terlebih dahulu sebelum memesan.';
  END IF;
  SELECT COALESCE((value->>'requirePhone')::boolean, false) INTO require_phone FROM app_settings WHERE key = 'booking';
  IF require_phone AND phone_ok IS NULL AND app_role() <> 'system' THEN
    RAISE EXCEPTION 'Verifikasi nomor telepon terlebih dahulu.';
  END IF;

  IF app_role() <> 'system' AND NEW.booking_date < (now() AT TIME ZONE 'Asia/Jakarta')::date THEN
    RAISE EXCEPTION 'Tanggal pemesanan sudah lewat.';
  END IF;

  NEW.amount := pkg_price;
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'ADL-' || lpad(nextval('booking_code_seq')::text, 4, '0');
  END IF;
  IF NEW.approval_expires_at IS NULL THEN
    NEW.approval_expires_at := now() + interval '2 minutes';
  END IF;
  NEW.status := COALESCE(NEW.status, 'WAITING_APPROVAL');
  RETURN NEW;
END $$;

CREATE TRIGGER bookings_insert_guard
  BEFORE INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION guard_booking_insert();

CREATE OR REPLACE FUNCTION after_booking_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  provider_user uuid;
BEGIN
  INSERT INTO booking_status_history (booking_id, status, note, actor_id)
  VALUES (NEW.id, NEW.status, 'Pesanan dibuat', NEW.customer_id);
  SELECT user_id INTO provider_user FROM provider_profiles WHERE id = NEW.provider_id;
  IF app_role() IS DISTINCT FROM 'system' THEN
    PERFORM notify_user(NEW.customer_id, 'booking_created', 'Pesanan dibuat', 'Pesanan ' || NEW.code || ' menunggu persetujuan mitra.', 'booking', NEW.id);
    PERFORM notify_user(provider_user, 'new_booking', 'Pesanan baru', 'Pesanan ' || NEW.code || ' menunggu jawaban Anda. Batas waktu 2 menit.', 'booking', NEW.id);
  END IF;
  INSERT INTO chat_threads (booking_id) VALUES (NEW.id);
  INSERT INTO payments (booking_id, amount, status, method)
  VALUES (NEW.id, NEW.amount, CASE WHEN NEW.status = 'COMPLETED' THEN 'PAID' ELSE 'UNPAID' END, 'CASH');
  RETURN NEW;
END $$;

CREATE TRIGGER bookings_after_insert
  AFTER INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION after_booking_insert();

CREATE OR REPLACE FUNCTION guard_booking_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  allowed boolean := false;
BEGIN
  IF NEW.customer_id <> OLD.customer_id OR NEW.provider_id <> OLD.provider_id
     OR NEW.service_id <> OLD.service_id OR NEW.package_id <> OLD.package_id
     OR NEW.amount <> OLD.amount OR NEW.booking_date <> OLD.booking_date
     OR NEW.time_slot <> OLD.time_slot OR NEW.code <> OLD.code THEN
    RAISE EXCEPTION 'Data inti pesanan tidak boleh diubah.';
  END IF;

  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'EXPIRED' AND OLD.status = 'WAITING_APPROVAL' AND OLD.approval_expires_at <= now() THEN
    RETURN NEW;
  END IF;

  IF app_role() = 'admin' THEN
    RETURN NEW;
  END IF;

  IF app_role() = 'customer' AND NEW.customer_id = app_uid() THEN
    allowed := OLD.status IN ('WAITING_APPROVAL', 'ACCEPTED', 'CONFIRMED') AND NEW.status = 'CANCELLED';
  ELSIF app_role() = 'provider' AND OLD.provider_id = my_provider_id() THEN
    IF OLD.status = 'WAITING_APPROVAL' AND OLD.approval_expires_at <= now() THEN
      RAISE EXCEPTION 'Waktu persetujuan habis. Pesanan kedaluwarsa.';
    END IF;
    allowed := (OLD.status = 'WAITING_APPROVAL' AND NEW.status IN ('ACCEPTED', 'REJECTED'))
      OR (OLD.status = 'ACCEPTED' AND NEW.status IN ('CONFIRMED', 'PROVIDER_ON_THE_WAY', 'CANCELLED'))
      OR (OLD.status = 'CONFIRMED' AND NEW.status IN ('PROVIDER_ON_THE_WAY', 'CANCELLED'))
      OR (OLD.status = 'PROVIDER_ON_THE_WAY' AND NEW.status = 'ARRIVED')
      OR (OLD.status = 'ARRIVED' AND NEW.status = 'ON_PROGRESS')
      OR (OLD.status = 'ON_PROGRESS' AND NEW.status = 'COMPLETED');
  ELSIF app_role() = 'system' THEN
    allowed := true;
  END IF;

  IF NOT allowed THEN
    RAISE EXCEPTION 'Perubahan status tidak diizinkan.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER bookings_update_guard
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION guard_booking_update();

CREATE OR REPLACE FUNCTION after_booking_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  provider_user uuid;
  title text;
  customer_type text;
  provider_type text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  INSERT INTO booking_status_history (booking_id, status, note, actor_id)
  VALUES (NEW.id, NEW.status, NEW.status, app_uid());
  SELECT user_id INTO provider_user FROM provider_profiles WHERE id = NEW.provider_id;

  customer_type := CASE NEW.status
    WHEN 'ACCEPTED' THEN 'booking_accepted'
    WHEN 'REJECTED' THEN 'booking_rejected'
    WHEN 'EXPIRED' THEN 'booking_expired'
    WHEN 'PROVIDER_ON_THE_WAY' THEN 'provider_on_the_way'
    WHEN 'ARRIVED' THEN 'provider_arrived'
    WHEN 'ON_PROGRESS' THEN 'service_started'
    WHEN 'COMPLETED' THEN 'service_completed'
    WHEN 'CANCELLED' THEN 'cancellation_status'
    ELSE 'booking_update'
  END;
  provider_type := CASE NEW.status
    WHEN 'CANCELLED' THEN 'booking_cancelled'
    WHEN 'EXPIRED' THEN 'booking_expired'
    ELSE 'booking_update'
  END;
  title := 'Status pesanan ' || NEW.code;

  PERFORM notify_user(NEW.customer_id, customer_type, title, 'Status terbaru: ' || NEW.status || '.', 'booking', NEW.id);
  IF provider_user IS NOT NULL THEN
    PERFORM notify_user(provider_user, provider_type, title, 'Status terbaru: ' || NEW.status || '.', 'booking', NEW.id);
  END IF;

  IF NEW.status = 'COMPLETED' THEN
    UPDATE payments SET status = 'PAID', updated_at = now() WHERE booking_id = NEW.id AND status = 'UNPAID';
  ELSIF NEW.status = 'REFUNDED' THEN
    UPDATE payments SET status = 'REFUNDED', updated_at = now() WHERE booking_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER bookings_after_status
  AFTER UPDATE OF status ON bookings
  FOR EACH ROW EXECUTE FUNCTION after_booking_status();

CREATE OR REPLACE FUNCTION expire_bookings() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n integer;
BEGIN
  UPDATE bookings
    SET status = 'EXPIRED'
    WHERE status = 'WAITING_APPROVAL' AND approval_expires_at <= now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION guard_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b bookings%ROWTYPE;
BEGIN
  SELECT * INTO b FROM bookings WHERE id = NEW.booking_id;
  IF b.id IS NULL OR b.customer_id <> NEW.customer_id OR b.status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'Ulasan hanya bisa diberikan setelah pesanan selesai.';
  END IF;
  IF b.provider_id <> NEW.provider_id OR b.service_id <> NEW.service_id THEN
    RAISE EXCEPTION 'Ulasan tidak sesuai dengan pesanan.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER reviews_guard BEFORE INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION guard_review();

CREATE OR REPLACE FUNCTION guard_location() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  st text;
BEGIN
  SELECT status INTO st FROM bookings WHERE id = NEW.booking_id AND provider_id = NEW.provider_id;
  IF st IS DISTINCT FROM 'PROVIDER_ON_THE_WAY' THEN
    RAISE EXCEPTION 'Pelacakan lokasi hanya aktif saat mitra dalam perjalanan.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER locations_guard BEFORE INSERT ON provider_locations
  FOR EACH ROW EXECUTE FUNCTION guard_location();

CREATE OR REPLACE FUNCTION guard_comparison() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  cnt int;
  cat uuid;
  existing uuid;
BEGIN
  SELECT count(*) INTO cnt FROM comparisons WHERE user_id = NEW.user_id AND service_id <> NEW.service_id;
  IF cnt >= 3 THEN
    RAISE EXCEPTION 'Maksimal 3 jasa untuk dibandingkan.';
  END IF;
  SELECT category_id INTO cat FROM services WHERE id = NEW.service_id;
  SELECT s.category_id INTO existing
    FROM comparisons c JOIN services s ON s.id = c.service_id
    WHERE c.user_id = NEW.user_id AND c.service_id <> NEW.service_id
    LIMIT 1;
  IF existing IS NOT NULL AND existing <> cat THEN
    RAISE EXCEPTION 'Bandingkan jasa dalam kategori yang sama.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER comparisons_guard BEFORE INSERT ON comparisons
  FOR EACH ROW EXECUTE FUNCTION guard_comparison();

CREATE OR REPLACE FUNCTION guard_profile_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF app_role() NOT IN ('admin', 'system') AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.email IS DISTINCT FROM OLD.email OR NEW.password_hash IS DISTINCT FROM OLD.password_hash) THEN
    RAISE EXCEPTION 'Perubahan akun ini tidak diizinkan.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER profiles_guard BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION guard_profile_update();

CREATE OR REPLACE FUNCTION guard_notification_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id <> OLD.user_id OR NEW.type <> OLD.type OR NEW.title <> OLD.title OR NEW.message <> OLD.message THEN
    RAISE EXCEPTION 'Notifikasi tidak boleh diubah.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER notifications_guard BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION guard_notification_update();

-- Open slot helper used by search.
CREATE OR REPLACE FUNCTION provider_has_open_slot(pid uuid, day date) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM unnest(ARRAY['08:00','09:00','10:00','11:00','13:00','14:00','15:00','16:00','17:00']) AS slot
    WHERE NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.provider_id = pid
        AND b.booking_date = day
        AND b.time_slot = slot
        AND b.status IN ('WAITING_APPROVAL','ACCEPTED','CONFIRMED','PROVIDER_ON_THE_WAY','ARRIVED','ON_PROGRESS')
    )
    AND (
      day > (now() AT TIME ZONE 'Asia/Jakarta')::date
      OR slot > to_char(now() AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_price_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_cancellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE homepage_carousels ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON profiles FOR SELECT USING (
  id = app_uid() OR app_role() IN ('admin', 'system')
  OR id IN (
    SELECT b.customer_id FROM bookings b WHERE b.provider_id = my_provider_id()
    UNION
    SELECT p.user_id FROM provider_profiles p
      JOIN bookings b ON b.provider_id = p.id
      WHERE b.customer_id = app_uid()
  )
);
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (app_role() IN ('admin', 'system'));
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (id = app_uid() OR app_role() IN ('admin', 'system'));

CREATE POLICY sessions_system ON sessions FOR ALL USING (app_role() = 'system') WITH CHECK (app_role() = 'system');
CREATE POLICY email_tokens_system ON email_tokens FOR ALL USING (app_role() = 'system') WITH CHECK (app_role() = 'system');
CREATE POLICY phone_otps_system ON phone_otps FOR ALL USING (app_role() = 'system') WITH CHECK (app_role() = 'system');
CREATE POLICY login_attempts_system ON login_attempts FOR ALL USING (app_role() = 'system') WITH CHECK (app_role() = 'system');

CREATE POLICY settings_read ON app_settings FOR SELECT USING (true);
CREATE POLICY settings_write ON app_settings FOR ALL USING (app_role() = 'admin') WITH CHECK (app_role() = 'admin');

CREATE POLICY categories_read ON categories FOR SELECT USING (is_active OR app_role() IN ('admin', 'system'));
CREATE POLICY categories_write ON categories FOR ALL USING (app_role() = 'admin') WITH CHECK (app_role() = 'admin');

CREATE POLICY providers_read ON provider_profiles FOR SELECT USING (
  app_role() IN ('admin', 'system')
  OR user_id = app_uid()
  OR (status = 'VERIFIED' AND deleted_at IS NULL)
);
CREATE POLICY providers_insert ON provider_profiles FOR INSERT WITH CHECK (
  app_role() IN ('admin', 'system') OR user_id = app_uid()
);
CREATE POLICY providers_update ON provider_profiles FOR UPDATE USING (
  app_role() IN ('admin', 'system') OR user_id = app_uid()
);

CREATE POLICY verifications_read ON provider_verifications FOR SELECT USING (
  app_role() IN ('admin', 'system') OR provider_id = my_provider_id()
);
CREATE POLICY verifications_write ON provider_verifications FOR INSERT WITH CHECK (app_role() IN ('admin', 'system'));

CREATE POLICY services_read ON services FOR SELECT USING (
  app_role() IN ('admin', 'system')
  OR provider_id = my_provider_id()
  OR (is_active AND archived_at IS NULL AND EXISTS (
    SELECT 1 FROM provider_profiles p
    WHERE p.id = services.provider_id AND p.status = 'VERIFIED' AND p.deleted_at IS NULL
  ))
);
CREATE POLICY services_write ON services FOR ALL USING (
  app_role() = 'admin' OR provider_id = my_provider_id()
) WITH CHECK (
  app_role() IN ('admin', 'system') OR provider_id = my_provider_id()
);

CREATE POLICY packages_read ON service_price_packages FOR SELECT USING (
  EXISTS (SELECT 1 FROM services s WHERE s.id = service_price_packages.service_id)
);
CREATE POLICY packages_write ON service_price_packages FOR ALL USING (
  EXISTS (SELECT 1 FROM services s WHERE s.id = service_id AND (s.provider_id = my_provider_id() OR app_role() = 'admin'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM services s WHERE s.id = service_id AND (s.provider_id = my_provider_id() OR app_role() IN ('admin', 'system')))
);

CREATE POLICY portfolios_read ON portfolios FOR SELECT USING (
  app_role() IN ('admin', 'system') OR provider_id = my_provider_id()
  OR EXISTS (SELECT 1 FROM provider_profiles p WHERE p.id = portfolios.provider_id AND p.status = 'VERIFIED' AND p.deleted_at IS NULL)
);
CREATE POLICY portfolios_write ON portfolios FOR ALL USING (
  app_role() = 'admin' OR provider_id = my_provider_id()
) WITH CHECK (app_role() IN ('admin', 'system') OR provider_id = my_provider_id());

CREATE POLICY availability_read ON provider_availability FOR SELECT USING (
  provider_id = my_provider_id() OR app_role() IN ('admin', 'system')
  OR EXISTS (SELECT 1 FROM provider_profiles p WHERE p.id = provider_availability.provider_id AND p.status = 'VERIFIED' AND p.deleted_at IS NULL)
);
CREATE POLICY availability_write ON provider_availability FOR ALL USING (
  provider_id = my_provider_id() OR app_role() = 'admin'
) WITH CHECK (provider_id = my_provider_id() OR app_role() IN ('admin', 'system'));

CREATE POLICY banks_all ON provider_bank_accounts FOR ALL USING (
  provider_id = my_provider_id() OR app_role() IN ('admin', 'system')
) WITH CHECK (provider_id = my_provider_id() OR app_role() IN ('admin', 'system'));

CREATE POLICY bookings_read ON bookings FOR SELECT USING (
  customer_id = app_uid() OR provider_id = my_provider_id() OR app_role() IN ('admin', 'system')
);
CREATE POLICY bookings_insert ON bookings FOR INSERT WITH CHECK (
  (customer_id = app_uid() AND app_role() = 'customer') OR app_role() IN ('admin', 'system')
);
CREATE POLICY bookings_update ON bookings FOR UPDATE USING (
  customer_id = app_uid() OR provider_id = my_provider_id() OR app_role() IN ('admin', 'system')
);

CREATE POLICY history_read ON booking_status_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_status_history.booking_id)
);
CREATE POLICY history_write ON booking_status_history FOR INSERT WITH CHECK (app_role() IN ('admin', 'system'));

CREATE POLICY cancellations_read ON booking_cancellations FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_cancellations.booking_id)
);
CREATE POLICY cancellations_write ON booking_cancellations FOR INSERT WITH CHECK (
  cancelled_by = app_uid() OR app_role() IN ('admin', 'system')
);

CREATE POLICY payments_read ON payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookings b WHERE b.id = payments.booking_id)
);

CREATE POLICY threads_read ON chat_threads FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookings b WHERE b.id = chat_threads.booking_id)
);
CREATE POLICY messages_read ON chat_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM chat_threads t WHERE t.id = chat_messages.thread_id)
);
CREATE POLICY messages_insert ON chat_messages FOR INSERT WITH CHECK (
  sender_id = app_uid() AND EXISTS (SELECT 1 FROM chat_threads t WHERE t.id = thread_id)
);
CREATE POLICY messages_update ON chat_messages FOR UPDATE USING (
  EXISTS (SELECT 1 FROM chat_threads t WHERE t.id = chat_messages.thread_id)
);
CREATE POLICY presence_all ON chat_presence FOR ALL USING (
  user_id = app_uid() OR EXISTS (SELECT 1 FROM chat_threads t WHERE t.id = chat_presence.thread_id)
) WITH CHECK (user_id = app_uid());

CREATE POLICY reviews_read ON reviews FOR SELECT USING (hidden_at IS NULL OR customer_id = app_uid() OR app_role() IN ('admin', 'system'));
CREATE POLICY reviews_insert ON reviews FOR INSERT WITH CHECK (customer_id = app_uid() OR app_role() = 'system');
CREATE POLICY reviews_update ON reviews FOR UPDATE USING (app_role() = 'admin');
CREATE POLICY review_images_read ON review_images FOR SELECT USING (
  EXISTS (SELECT 1 FROM reviews r WHERE r.id = review_images.review_id AND (r.hidden_at IS NULL OR app_role() = 'admin'))
);
CREATE POLICY review_images_insert ON review_images FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM reviews r WHERE r.id = review_id AND r.customer_id = app_uid())
);

CREATE POLICY complaints_read ON complaints FOR SELECT USING (
  app_role() IN ('admin', 'system')
  OR opened_by = app_uid()
  OR EXISTS (
    SELECT 1 FROM bookings b WHERE b.id = complaints.booking_id
      AND (b.customer_id = app_uid() OR b.provider_id = my_provider_id())
  )
);
CREATE POLICY complaints_insert ON complaints FOR INSERT WITH CHECK (opened_by = app_uid() OR app_role() = 'admin');
CREATE POLICY complaints_update ON complaints FOR UPDATE USING (
  app_role() = 'admin' OR opened_by = app_uid()
);
CREATE POLICY complaint_messages_all ON complaint_messages FOR ALL USING (
  EXISTS (SELECT 1 FROM complaints c WHERE c.id = complaint_messages.complaint_id)
) WITH CHECK (
  sender_id = app_uid() AND EXISTS (SELECT 1 FROM complaints c WHERE c.id = complaint_id)
);
CREATE POLICY complaint_files_read ON complaint_attachments FOR SELECT USING (
  EXISTS (SELECT 1 FROM complaints c WHERE c.id = complaint_attachments.complaint_id)
);
CREATE POLICY complaint_files_write ON complaint_attachments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM complaints c WHERE c.id = complaint_id AND (c.opened_by = app_uid() OR app_role() = 'admin'))
);

CREATE POLICY notifications_read ON notifications FOR SELECT USING (user_id = app_uid() OR app_role() IN ('admin', 'system'));
CREATE POLICY notifications_update ON notifications FOR UPDATE USING (user_id = app_uid() OR app_role() = 'admin');

CREATE POLICY locations_read ON provider_locations FOR SELECT USING (
  provider_id = my_provider_id() OR app_role() IN ('admin', 'system')
  OR EXISTS (SELECT 1 FROM bookings b WHERE b.id = provider_locations.booking_id AND b.customer_id = app_uid())
);
CREATE POLICY locations_insert ON provider_locations FOR INSERT WITH CHECK (provider_id = my_provider_id() OR app_role() = 'system');

CREATE POLICY favorites_all ON favorites FOR ALL USING (customer_id = app_uid() OR app_role() IN ('admin', 'system'))
  WITH CHECK (customer_id = app_uid() OR app_role() = 'system');

CREATE POLICY comparisons_all ON comparisons FOR ALL USING (user_id = app_uid() OR app_role() IN ('admin', 'system'))
  WITH CHECK (user_id = app_uid());

CREATE POLICY highlights_read ON highlights FOR SELECT USING (
  app_role() IN ('admin', 'system')
  OR (is_active AND (start_at IS NULL OR start_at <= now()) AND (end_at IS NULL OR end_at >= now()))
);
CREATE POLICY highlights_write ON highlights FOR ALL USING (app_role() = 'admin') WITH CHECK (app_role() = 'admin');

CREATE POLICY carousels_read ON homepage_carousels FOR SELECT USING (
  app_role() IN ('admin', 'system')
  OR (is_active AND (start_at IS NULL OR start_at <= now()) AND (end_at IS NULL OR end_at >= now()))
);
CREATE POLICY carousels_write ON homepage_carousels FOR ALL USING (app_role() = 'admin') WITH CHECK (app_role() = 'admin');

CREATE POLICY audit_read ON audit_logs FOR SELECT USING (app_role() = 'admin');
CREATE POLICY audit_write ON audit_logs FOR INSERT WITH CHECK (app_role() IN ('admin', 'system'));

CREATE POLICY support_insert ON support_requests FOR INSERT WITH CHECK (true);
CREATE POLICY support_read ON support_requests FOR SELECT USING (app_role() = 'admin');

GRANT USAGE ON SCHEMA public TO andallo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO andallo_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO andallo_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO andallo_app;

INSERT INTO app_settings (key, value) VALUES
  ('booking', '{"requirePhone": false, "approvalMinutes": 2}'::jsonb),
  ('brand', '{"supportEmail": "halo@andallo.id"}'::jsonb)
ON CONFLICT (key) DO NOTHING;
