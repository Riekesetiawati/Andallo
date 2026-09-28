# Andallo

Andallo is a marketplace that connects customers with local service providers. Customers search and compare jasa, book a time slot, chat, track a trip, and review a completed order. Providers manage their services, prices, schedule, and bookings. Admins run the Andallo WMS: verification, transactions, complaints, and homepage content.

The app is a Next.js (App Router) application with PostgreSQL and PostGIS. Row level security is enforced for the application role. Supabase Auth, Realtime, and Storage are used when their environment variables are set. Without them, the same schema runs on local Postgres, chat and notifications update over server-sent events, and uploads are stored on disk.

## Architecture

- `app/` routes for the public marketplace, customer area, mitra dashboard, and admin WMS, plus route handlers for slots, uploads, location, cron expiry, and the realtime stream.
- `app/actions.ts` server actions. Authorization is checked again on the server, not only in the browser.
- `lib/` database access, session cookies, validation, and catalog queries.
- `supabase/migrations/0001_init.sql` schema, constraints, triggers, and RLS.
- `supabase/seed.sql` generated development data. Do not load it in production.
- `middleware.ts` rejects the wrong role before the page renders. Layouts call `requireActor` again and the database policies apply to `andallo_app`.

Roles are `customer`, `provider`, and `admin`. A provider cannot read another provider’s bank data or bookings. A customer cannot open `/admin` or `/mitra/dashboard`.

## Requirements

- Node.js 22
- PostgreSQL 16 with PostGIS
- A non-superuser database role for the app, so RLS is actually applied

## Installation

```bash
npm install
cp .env.example .env
```

Fill `DATABASE_URL` and `SESSION_SECRET`. Never commit `.env`.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection for a non-superuser role |
| `SESSION_SECRET` | HMAC key for the session cookie |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional browser key. Safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Never prefix with `NEXT_PUBLIC_` |
| `ANDALLO_DEV_LINKS` | Show verification and reset links on screen. Development only |
| `ANDALLO_DEV_OTP` | Show the phone OTP on screen. Development only |
| `CRON_SECRET` | If set, `GET /api/cron/expire` requires `Authorization: Bearer <secret>` |

## Supabase setup

1. Create a project and enable PostGIS (`CREATE EXTENSION postgis`).
2. Run `supabase/migrations/0001_init.sql` in the SQL editor.
3. Create storage buckets: `avatars`, `provider-covers`, `portfolios`, `complaint-evidence`, `review-images`, `bank-verification`. Limit uploads to jpeg, png, webp, and pdf, 5 MB. Keep bank evidence private.
4. Put the pooler URL in `DATABASE_URL` using a role that is not a superuser.
5. Put the anon key in `NEXT_PUBLIC_SUPABASE_ANON_KEY` and the service role key only in `SUPABASE_SERVICE_ROLE_KEY`.

When those keys are absent, uploads stay in `public/uploads` (gitignored). That disk is ephemeral on Vercel, so production should use Supabase Storage.

## Database migration and seed

```bash
sudo -u postgres psql -d andallo -f supabase/migrations/0001_init.sql
npm run db:seed
```

`scripts/seed.mjs` writes `supabase/seed.sql` and applies it. It creates 7 categories and 35 verified providers around Bekasi, Jakarta, and Tangerang, plus packages, portfolios, hours, reviews, and demo bookings. Re-running replaces development data.

The seed creates demo passwords only when you run it yourself. Do not run it against production.

## Authentication

Sessions are an HMAC-signed cookie (`andallo_session`) whose token hash is stored in `sessions`. Passwords use scrypt. Login accepts email and password, with a remember-me option (30 days, otherwise 1 day).

Email verification and password reset create single-use tokens in `email_tokens`. With `ANDALLO_DEV_LINKS=1` the link is shown in the UI because SMTP is not bundled. On Supabase, point the Auth email templates at `/verifikasi` and `/reset-password` if you move verification into Supabase Auth.

Phone OTP is stored in `phone_otps`. Without an SMS provider the code is shown only when `ANDALLO_DEV_OTP=1` or `NODE_ENV` is not production. Unverified email cannot create a booking. Phone verification is required only when an admin turns that setting on.

## Development

```bash
npm run dev
```

## Demo accounts

Development seed only. Password for each is `demo123`.

| Role | Email |
| --- | --- |
| Customer | rieke@andallo.com |
| Provider | mitra@andallo.com |
| Admin | admin@andallo.com |

Admin signs in at `/admin/login`. Customers and providers use `/login`.

## Testing

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

`npm test` checks catalog counts, RLS, double-booking, review rules, comparison limits, and favorite uniqueness against the local database. It rolls back every scenario.

## Build

```bash
npm run build
npm start
```

## Deployment

Target: Vercel for the Next.js app, Supabase Postgres for data, and Supabase Storage for uploads.

There is no `server.js`. Vercel builds this with the Next.js builder (`npm run build`). Do not set the framework to Other or a custom `node server.js` command.

Production does not use a local database. `DATABASE_URL` is read at runtime. The build does not connect to Postgres.

Checklist:

1. Import the repository in Vercel. Framework preset: Next.js. Root directory: the repository root.
2. In Project Settings → Deployment Protection, turn off Vercel Authentication for Production. While it is on, the deployment URL redirects to Vercel login and visitors cannot open the site.
3. Set `DATABASE_URL` to the Supabase **Session pooler** URI (`*.pooler.supabase.com`, port `5432`). Do not paste a `127.0.0.1` URL. Do not use the direct `db.[ref].supabase.co` host.
4. Set a long random `SESSION_SECRET`.
5. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Leave `ANDALLO_DEV_LINKS` and `ANDALLO_DEV_OTP` unset.
6. Apply `supabase/migrations/0001_init.sql` in the Supabase SQL editor, including PostGIS. Do not apply `seed.sql` to production.
7. Create the storage buckets listed above.
8. Redeploy after the variables are saved. Environment changes do not apply to an already built deployment until the next deploy.
9. Schedule `GET /api/cron/expire` every minute with `CRON_SECRET`. Open booking pages also expire due bookings.
10. Confirm `/` renders the marketplace and `/admin` redirects anonymous visitors to `/admin/login`.

The browser calls same-origin `/api/*` routes. Chat and notifications use a short server stream that reconnects; it does not keep a process running.

Payments are recorded as cash (`UNPAID` until the provider marks the booking completed). There is no payment gateway.

## Security notes

- The service role key is read only on the server.
- RLS policies are in the migration. The app role must not bypass them.
- Booking slots use an advisory lock and a partial unique index. A second insert of the same provider, date, and open slot fails.
- Reviews can be inserted only for `COMPLETED` bookings, one per booking.
- Admin moderation hides a review; it does not rewrite the star rating.
- Bank numbers are masked in the UI. Providers see only their own rows.
- Uploads are limited by MIME type and 5 MB.
- Redirects after login only allow same-site paths.
