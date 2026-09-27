import { withActor, type Actor, type Role } from './db';
import { SLOTS, todayJakarta } from './format';

export type ServiceCard = {
  id: string;
  name: string;
  description: string;
  minPrice: number;
  maxPrice: number;
  durationMin: number;
  serviceMethod: string;
  imageUrl: string | null;
  providerId: string;
  slug: string;
  businessName: string;
  city: string;
  categoryName: string;
  categorySlug: string;
  rating: number;
  reviewCount: number;
  distanceKm: number | null;
  coverUrl: string | null;
};

export type SearchFilters = {
  q?: string;
  category?: string;
  city?: string;
  lat?: string;
  lng?: string;
  radius?: string;
  minPrice?: string;
  maxPrice?: string;
  rating?: string;
  method?: string;
  date?: string;
  sort?: string;
  page?: string;
};

const SORTS: Record<string, string> = {
  distance: 'distance_km ASC NULLS LAST, rating DESC',
  price_asc: 'min_price ASC, rating DESC',
  price_desc: 'min_price DESC',
  rating: 'rating DESC, review_count DESC',
  reviews: 'review_count DESC, rating DESC',
  newest: 'created_at DESC',
};

function num(value?: string) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function searchServices(filters: SearchFilters, actor?: Actor | null) {
  const q = (filters.q || '').trim().slice(0, 80);
  const categories = (filters.category || '').split(',').map((item) => item.trim()).filter(Boolean);
  const lat = num(filters.lat);
  const lng = num(filters.lng);
  const radius = num(filters.radius);
  const minPrice = num(filters.minPrice);
  const maxPrice = num(filters.maxPrice);
  const rating = num(filters.rating);
  const page = Math.max(1, Number(filters.page || 1) || 1);
  const limit = 12;
  const sort = SORTS[filters.sort || ''] || (lat != null ? SORTS.distance : SORTS.rating);
  const role: Role = actor?.role || 'anon';
  return withActor({ id: actor?.id, role }, async (db) => {
    const params = [q, categories, filters.city || '', lat, lng, radius, minPrice, maxPrice, rating, filters.method || '', filters.date || null, limit, (page - 1) * limit];
    const { rows } = await db.query(
      `SELECT s.id, s.name, s.description, s.min_price, s.max_price, s.duration_min, s.service_method, COALESCE(s.image_url, p.cover_url) AS image_url,
              s.created_at, p.id AS provider_id, p.slug, p.business_name, p.city, c.name AS category_name, c.slug AS category_slug,
              p.cover_url, COALESCE(rv.rating, 0)::float8 AS rating, COALESCE(rv.review_count, 0)::int AS review_count,
              CASE WHEN $4::float8 IS NULL THEN NULL ELSE round((ST_Distance(p.location, ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography) / 1000)::numeric, 1) END AS distance_km,
              count(*) OVER()::int AS total
       FROM services s
       JOIN provider_profiles p ON p.id = s.provider_id
       JOIN categories c ON c.id = s.category_id
       LEFT JOIN LATERAL (
         SELECT round(avg(rating)::numeric, 2) AS rating, count(*) AS review_count
         FROM reviews r WHERE r.provider_id = p.id AND r.hidden_at IS NULL
       ) rv ON true
       WHERE ($1 = '' OR s.name ILIKE '%' || $1 || '%' OR p.business_name ILIKE '%' || $1 || '%' OR c.name ILIKE '%' || $1 || '%' OR p.city ILIKE '%' || $1 || '%' OR s.description ILIKE '%' || $1 || '%')
         AND (cardinality($2::text[]) = 0 OR c.slug = ANY($2::text[]))
         AND ($3 = '' OR p.city ILIKE $3)
         AND ($7::int IS NULL OR s.min_price >= $7)
         AND ($8::int IS NULL OR s.min_price <= $8)
         AND ($9::numeric IS NULL OR COALESCE(rv.rating, 0) >= $9)
         AND ($10 = '' OR s.service_method = $10 OR ($10 <> '' AND s.service_method = 'BOTH'))
         AND ($6::numeric IS NULL OR $4::float8 IS NULL OR ST_DWithin(p.location, ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography, $6 * 1000))
         AND ($11::date IS NULL OR provider_has_open_slot(p.id, $11::date))
       ORDER BY ${sort}
       LIMIT $12 OFFSET $13`,
      params,
    );
    const items: ServiceCard[] = rows.map(mapCard);
    return { items, total: rows[0]?.total ?? 0, page, pages: Math.max(1, Math.ceil((rows[0]?.total ?? 0) / limit)) };
  });
}

function mapCard(row: Record<string, unknown>): ServiceCard {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description || ''),
    minPrice: Number(row.min_price),
    maxPrice: Number(row.max_price),
    durationMin: Number(row.duration_min),
    serviceMethod: String(row.service_method),
    imageUrl: (row.image_url as string) || null,
    providerId: String(row.provider_id),
    slug: String(row.slug),
    businessName: String(row.business_name),
    city: String(row.city),
    categoryName: String(row.category_name),
    categorySlug: String(row.category_slug),
    rating: Number(row.rating),
    reviewCount: Number(row.review_count),
    distanceKm: row.distance_km == null ? null : Number(row.distance_km),
    coverUrl: (row.cover_url as string) || null,
  };
}

export async function listCategories(includeInactive = false) {
  return withActor({ role: includeInactive ? 'admin' : 'anon' }, async (db) => {
    const { rows } = await db.query(
      `SELECT c.id, c.name, c.slug, c.icon, c.sort_order, c.is_active,
              (SELECT count(*)::int FROM services s WHERE s.category_id = c.id AND s.is_active AND s.archived_at IS NULL) AS service_count
       FROM categories c
       ${includeInactive ? '' : 'WHERE c.is_active'}
       ORDER BY c.sort_order, c.name`,
    );
    return rows;
  });
}

export async function homeData(lat?: number | null, lng?: number | null) {
  const [categories, highlights, carousel, recommended, nearby, testimonials] = await Promise.all([
    listCategories(),
    withActor({ role: 'anon' }, (db) => db.query(`SELECT h.id, h.headline, h.subtitle, h.banner_url, h.cta_label, p.slug, p.business_name FROM highlights h JOIN provider_profiles p ON p.id = h.provider_id WHERE h.is_active AND (h.start_at IS NULL OR h.start_at <= now()) AND (h.end_at IS NULL OR h.end_at >= now()) ORDER BY h.sort_order`)).then((r) => r.rows),
    withActor({ role: 'anon' }, (db) => db.query(`SELECT id, title, subtitle, image_url, link FROM homepage_carousels WHERE is_active AND (start_at IS NULL OR start_at <= now()) AND (end_at IS NULL OR end_at >= now()) ORDER BY sort_order`)).then((r) => r.rows),
    searchServices({ sort: 'rating', page: '1' }),
    lat != null && lng != null ? searchServices({ lat: String(lat), lng: String(lng), radius: '15', sort: 'distance' }) : searchServices({ sort: 'reviews' }),
    withActor({ role: 'anon' }, (db) =>
      db.query(
        `SELECT r.rating, r.comment, r.created_at, public_name(r.customer_id) AS full_name, pr.business_name
         FROM reviews r JOIN provider_profiles pr ON pr.id = r.provider_id
         WHERE r.hidden_at IS NULL ORDER BY r.rating DESC, r.created_at DESC LIMIT 3`,
      ),
    ).then((r) => r.rows),
  ]);
  return { categories, highlights, carousel, recommended: recommended.items.slice(0, 4), nearby: nearby.items.slice(0, 4), testimonials };
}

export async function getProvider(slug: string, actor?: Actor | null, coords?: { lat: number; lng: number }) {
  const role: Role = actor?.role || 'anon';
  return withActor({ id: actor?.id, role }, async (db) => {
    const { rows } = await db.query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
              COALESCE(rv.rating, 0)::float8 AS rating, COALESCE(rv.review_count, 0)::int AS review_count,
              CASE WHEN $2::float8 IS NULL THEN NULL ELSE round((ST_Distance(p.location, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography) / 1000)::numeric, 1) END AS distance_km
       FROM provider_profiles p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN LATERAL (
         SELECT round(avg(rating)::numeric, 2) AS rating, count(*) AS review_count FROM reviews r WHERE r.provider_id = p.id AND r.hidden_at IS NULL
       ) rv ON true
       WHERE p.slug = $1`,
      [slug, coords?.lat ?? null, coords?.lng ?? null],
    );
    if (!rows[0]) return null;
    const provider = rows[0];
    const [services, portfolio, reviews, distribution, favorite] = await Promise.all([
      db.query(
        `SELECT s.*, COALESCE(json_agg(json_build_object('id', pk.id, 'name', pk.name, 'description', pk.description, 'price', pk.price, 'durationMin', pk.duration_min) ORDER BY pk.sort_order) FILTER (WHERE pk.id IS NOT NULL), '[]') AS packages
         FROM services s LEFT JOIN service_price_packages pk ON pk.service_id = s.id AND pk.is_active
         WHERE s.provider_id = $1 GROUP BY s.id ORDER BY s.created_at`,
        [provider.id],
      ),
      db.query(`SELECT id, image_url, caption, sort_order FROM portfolios WHERE provider_id = $1 ORDER BY sort_order`, [provider.id]),
      db.query(
        `SELECT r.id, r.rating, r.comment, r.created_at, public_name(r.customer_id) AS full_name, s.name AS service_name
         FROM reviews r JOIN services s ON s.id = r.service_id
         WHERE r.provider_id = $1 AND r.hidden_at IS NULL ORDER BY r.created_at DESC LIMIT 20`,
        [provider.id],
      ),
      db.query(`SELECT rating, count(*)::int AS count FROM reviews WHERE provider_id = $1 AND hidden_at IS NULL GROUP BY rating`, [provider.id]),
      actor?.role === 'customer'
        ? db.query(`SELECT 1 FROM favorites WHERE customer_id = $1 AND provider_id = $2`, [actor.id, provider.id])
        : Promise.resolve({ rows: [] as unknown[] }),
    ]);
    return { provider, services: services.rows, portfolio: portfolio.rows, reviews: reviews.rows, distribution: distribution.rows, favorite: favorite.rows.length > 0 };
  });
}

export async function getService(serviceId: string, actor?: Actor | null) {
  return withActor({ id: actor?.id, role: actor?.role || 'anon' }, async (db) => {
    const { rows } = await db.query(
      `SELECT s.*, p.slug, p.business_name, p.city, p.status, p.operating_hours, c.name AS category_name
       FROM services s JOIN provider_profiles p ON p.id = s.provider_id JOIN categories c ON c.id = s.category_id
       WHERE s.id = $1`,
      [serviceId],
    );
    if (!rows[0]) return null;
    const packages = await db.query(`SELECT * FROM service_price_packages WHERE service_id = $1 AND is_active ORDER BY sort_order`, [serviceId]);
    return { service: rows[0], packages: packages.rows };
  });
}

export async function slotsFor(providerId: string, date: string) {
  return withActor({ role: 'anon' }, async (db) => {
    const taken = await db.query(
      `SELECT time_slot FROM bookings WHERE provider_id = $1 AND booking_date = $2 AND status IN ('WAITING_APPROVAL','ACCEPTED','CONFIRMED','PROVIDER_ON_THE_WAY','ARRIVED','ON_PROGRESS')`,
      [providerId, date],
    );
    const hours = await db.query(`SELECT weekday, start_time::text, end_time::text, is_active FROM provider_availability WHERE provider_id = $1`, [providerId]);
    const weekday = new Date(`${date}T12:00:00+07:00`).getUTCDay();
    const row = hours.rows.find((item) => Number(item.weekday) === weekday);
    const busy = new Set(taken.rows.map((item) => item.time_slot as string));
    const now = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
    return SLOTS.map((slot) => {
      let closed = false;
      if (row && row.is_active === false) closed = true;
      if (row?.start_time && slot < String(row.start_time).slice(0, 5)) closed = true;
      if (row?.end_time && slot >= String(row.end_time).slice(0, 5)) closed = true;
      if (date === todayJakarta() && slot <= now) closed = true;
      if (date < todayJakarta()) closed = true;
      return { slot, available: !closed && !busy.has(slot), full: busy.has(slot) };
    });
  });
}

export async function compareServices(actor: Actor, coords?: { lat: number; lng: number }) {
  return withActor(actor, async (db) => {
    const { rows } = await db.query(
      `SELECT s.id, s.name, s.min_price, s.max_price, s.duration_min, s.service_method, COALESCE(s.image_url, p.cover_url) AS image_url,
              p.slug, p.business_name, p.city, p.id AS provider_id, c.name AS category_name, c.slug AS category_slug,
              COALESCE(rv.rating, 0)::float8 AS rating, COALESCE(rv.review_count, 0)::int AS review_count,
              (SELECT count(*)::int FROM portfolios pf WHERE pf.provider_id = p.id) AS portfolio_count,
              CASE WHEN $2::float8 IS NULL THEN NULL ELSE round((ST_Distance(p.location, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography) / 1000)::numeric, 1) END AS distance_km
       FROM comparisons cmp
       JOIN services s ON s.id = cmp.service_id
       JOIN provider_profiles p ON p.id = s.provider_id
       JOIN categories c ON c.id = s.category_id
       LEFT JOIN LATERAL (
         SELECT round(avg(rating)::numeric, 2) AS rating, count(*) AS review_count FROM reviews r WHERE r.provider_id = p.id AND r.hidden_at IS NULL
       ) rv ON true
       WHERE cmp.user_id = $1
       ORDER BY cmp.created_at`,
      [actor.id, coords?.lat ?? null, coords?.lng ?? null],
    );
    const packages = rows.length
      ? await db.query(`SELECT service_id, name, price FROM service_price_packages WHERE service_id = ANY($1::uuid[]) AND is_active ORDER BY sort_order`, [rows.map((row) => row.id)])
      : { rows: [] };
    return rows.map((row) => ({ ...mapCard({ ...row, description: '', cover_url: row.image_url, created_at: null }), portfolioCount: Number(row.portfolio_count), packages: packages.rows.filter((pkg) => pkg.service_id === row.id) }));
  });
}
