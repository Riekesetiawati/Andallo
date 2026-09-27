import { randomBytes, createHash } from 'node:crypto';
import { withActor, type Actor } from './db';
import { hashPassword, verifyPassword } from './password';
import { slugify } from './format';

const sha = (value: string) => createHash('sha256').update(value).digest('hex');

export async function registerCustomer(input: { name: string; email: string; phone: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  return withActor({ role: 'system' }, async (db) => {
    const { rows } = await db.query(
      `INSERT INTO profiles (email, phone, password_hash, role, full_name, terms_accepted_at)
       VALUES ($1, $2, $3, 'customer', $4, now()) RETURNING id, email, role`,
      [email, input.phone.trim(), hashPassword(input.password), input.name.trim()],
    );
    const token = randomBytes(24).toString('base64url');
    await db.query(`INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at) VALUES ($1, 'verify_email', $2, now() + interval '1 day')`, [rows[0].id, sha(token)]);
    return { user: rows[0], verifyPath: `/verifikasi?token=${token}` };
  });
}

export async function registerProvider(input: {
  name: string; businessName: string; email: string; phone: string; password: string; description: string;
  categoryId: string; address: string; city: string; lat: number; lng: number; radius: number; imageUrl?: string; documentUrl?: string;
}) {
  const email = input.email.trim().toLowerCase();
  return withActor({ role: 'system' }, async (db) => {
    const { rows } = await db.query(
      `INSERT INTO profiles (email, phone, password_hash, role, full_name, avatar_url, terms_accepted_at)
       VALUES ($1,$2,$3,'provider',$4,$5, now()) RETURNING id`,
      [email, input.phone.trim(), hashPassword(input.password), input.name.trim(), input.imageUrl || null],
    );
    const slugBase = slugify(input.businessName) || 'mitra';
    const slug = `${slugBase}-${rows[0].id.slice(0, 6)}`;
    const provider = await db.query(
      `INSERT INTO provider_profiles (user_id, slug, business_name, description, category_id, address, city, lat, lng, service_radius_km, cover_url, phone, business_email, status, document_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'SUBMITTED',$14) RETURNING id, slug`,
      [rows[0].id, slug, input.businessName.trim(), input.description.trim(), input.categoryId, input.address, input.city, input.lat, input.lng, input.radius, input.imageUrl || null, input.phone, email, input.documentUrl || null],
    );
    await db.query(`INSERT INTO provider_verifications (provider_id, status, note) VALUES ($1, 'SUBMITTED', 'Pengajuan baru')`, [provider.rows[0].id]);
    const token = randomBytes(24).toString('base64url');
    await db.query(`INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at) VALUES ($1, 'verify_email', $2, now() + interval '1 day')`, [rows[0].id, sha(token)]);
    const admins = await db.query(`SELECT id FROM profiles WHERE role = 'admin'`);
    for (const admin of admins.rows) {
      await db.query(`SELECT notify_user($1, 'provider_application', 'Pengajuan mitra baru', $2, 'provider', $3)`, [admin.id, input.businessName, provider.rows[0].id]);
    }
    return { userId: rows[0].id, slug: provider.rows[0].slug, verifyPath: `/verifikasi?token=${token}` };
  });
}

export async function authenticate(email: string, password: string, ip: string) {
  return withActor({ role: 'system' }, async (db) => {
    const attempts = await db.query(`SELECT count(*)::int AS n FROM login_attempts WHERE email = $1 AND created_at > now() - interval '15 minutes'`, [email]);
    if (attempts.rows[0].n >= 8) return { error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' as const };
    const { rows } = await db.query(`SELECT id, role, password_hash FROM profiles WHERE email = $1`, [email]);
    const user = rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      await db.query(`INSERT INTO login_attempts (email, ip) VALUES ($1, $2)`, [email, ip]);
      return { error: 'Email atau kata sandi salah.' as const };
    }
    await db.query(`DELETE FROM login_attempts WHERE email = $1`, [email]);
    return { user: { id: user.id as string, role: user.role as Actor['role'] } };
  });
}

export async function requestPasswordReset(email: string) {
  return withActor({ role: 'system' }, async (db) => {
    const { rows } = await db.query(`SELECT id FROM profiles WHERE email = $1`, [email]);
    if (!rows[0]) return { path: '' };
    const token = randomBytes(24).toString('base64url');
    await db.query(`INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at) VALUES ($1, 'reset_password', $2, now() + interval '30 minutes')`, [rows[0].id, sha(token)]);
    return { path: `/reset-password?token=${token}` };
  });
}

export async function resetPassword(token: string, password: string) {
  return withActor({ role: 'system' }, async (db) => {
    const { rows } = await db.query(
      `UPDATE email_tokens SET used_at = now() WHERE token_hash = $1 AND purpose = 'reset_password' AND used_at IS NULL AND expires_at > now() RETURNING user_id`,
      [sha(token)],
    );
    if (!rows[0]) return false;
    await db.query(`UPDATE profiles SET password_hash = $2 WHERE id = $1`, [rows[0].user_id, hashPassword(password)]);
    await db.query(`DELETE FROM sessions WHERE user_id = $1`, [rows[0].user_id]);
    return true;
  });
}

export async function verifyEmail(token: string) {
  return withActor({ role: 'system' }, async (db) => {
    const { rows } = await db.query(
      `UPDATE email_tokens SET used_at = now() WHERE token_hash = $1 AND purpose = 'verify_email' AND used_at IS NULL AND expires_at > now() RETURNING user_id`,
      [sha(token)],
    );
    if (!rows[0]) return false;
    await db.query(`UPDATE profiles SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1`, [rows[0].user_id]);
    return true;
  });
}

export async function sendPhoneOtp(actor: Actor) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await withActor({ role: 'system' }, (db) =>
    db.query(`INSERT INTO phone_otps (user_id, code_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes')`, [actor.id, sha(code)]),
  );
  return process.env.NODE_ENV === 'production' && process.env.ANDALLO_DEV_OTP !== '1' ? '' : code;
}

export async function confirmPhone(actor: Actor, code: string) {
  return withActor({ role: 'system' }, async (db) => {
    const { rows } = await db.query(
      `UPDATE phone_otps SET used_at = now() WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL AND expires_at > now() RETURNING id`,
      [actor.id, sha(code)],
    );
    if (!rows[0]) return false;
    await db.query(`UPDATE profiles SET phone_verified_at = now() WHERE id = $1`, [actor.id]);
    return true;
  });
}

export async function updateProfile(actor: Actor, input: { name: string; phone: string; avatarUrl?: string }) {
  return withActor(actor, (db) =>
    db.query(`UPDATE profiles SET full_name = $2, phone = $3, avatar_url = COALESCE($4, avatar_url) WHERE id = $1`, [actor.id, input.name, input.phone, input.avatarUrl || null]),
  );
}

export async function changePassword(actor: Actor, current: string, next: string) {
  const ok = await withActor({ role: 'system' }, async (db) => {
    const { rows } = await db.query(`SELECT password_hash FROM profiles WHERE id = $1`, [actor.id]);
    if (!verifyPassword(current, rows[0]?.password_hash)) return false;
    await db.query(`UPDATE profiles SET password_hash = $2 WHERE id = $1`, [actor.id, hashPassword(next)]);
    return true;
  });
  return ok;
}

export async function createBooking(actor: Actor, input: { serviceId: string; packageId: string; date: string; time: string; address: string; notes: string; method: string }) {
  return withActor(actor, async (db) => {
    const service = await db.query(`SELECT provider_id FROM services WHERE id = $1`, [input.serviceId]);
    if (!service.rows[0]) throw new Error('Jasa tidak ditemukan.');
    const { rows } = await db.query(
      `INSERT INTO bookings (customer_id, provider_id, service_id, package_id, booking_date, time_slot, address, notes, service_method)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, code`,
      [actor.id, service.rows[0].provider_id, input.serviceId, input.packageId, input.date, input.time, input.address, input.notes, input.method],
    );
    return rows[0] as { id: string; code: string };
  });
}

export async function listBookings(actor: Actor) {
  return withActor(actor, async (db) => {
    const { rows } = await db.query(
      `SELECT b.*, s.name AS service_name, p.business_name, p.slug, c.full_name AS customer_name,
              pay.status AS payment_status, pay.amount AS payment_amount,
              (SELECT id FROM chat_threads t WHERE t.booking_id = b.id) AS thread_id,
              EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id) AS reviewed
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       JOIN provider_profiles p ON p.id = b.provider_id
       JOIN profiles c ON c.id = b.customer_id
       LEFT JOIN payments pay ON pay.booking_id = b.id
       ORDER BY b.created_at DESC
       LIMIT 100`,
    );
    return rows;
  });
}

export async function getBooking(actor: Actor, id: string) {
  return withActor(actor, async (db) => {
    const { rows } = await db.query(
      `SELECT b.*, s.name AS service_name, pk.name AS package_name, p.business_name, p.slug, p.lat AS provider_lat, p.lng AS provider_lng,
              c.full_name AS customer_name, pay.status AS payment_status,
              (SELECT id FROM chat_threads t WHERE t.booking_id = b.id) AS thread_id,
              EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id) AS reviewed
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       JOIN service_price_packages pk ON pk.id = b.package_id
       JOIN provider_profiles p ON p.id = b.provider_id
       JOIN profiles c ON c.id = b.customer_id
       LEFT JOIN payments pay ON pay.booking_id = b.id
       WHERE b.id = $1`,
      [id],
    );
    if (!rows[0]) return null;
    const history = await db.query(`SELECT status, note, created_at FROM booking_status_history WHERE booking_id = $1 ORDER BY created_at`, [id]);
    const location = await db.query(`SELECT lat, lng, recorded_at FROM provider_locations WHERE booking_id = $1 ORDER BY recorded_at DESC LIMIT 1`, [id]);
    const cancellation = await db.query(`SELECT * FROM booking_cancellations WHERE booking_id = $1 ORDER BY cancelled_at DESC LIMIT 1`, [id]);
    return { booking: rows[0], history: history.rows, location: location.rows[0] || null, cancellation: cancellation.rows[0] || null };
  });
}

export async function setBookingStatus(actor: Actor, id: string, status: string) {
  return withActor(actor, (db) => db.query(`UPDATE bookings SET status = $2 WHERE id = $1`, [id, status]));
}

export async function cancelBooking(actor: Actor, id: string, reason: string, note: string) {
  return withActor(actor, async (db) => {
    await db.query(
      `INSERT INTO booking_cancellations (booking_id, cancelled_by, cancelled_by_role, reason, note) VALUES ($1,$2,$3,$4,$5)`,
      [id, actor.id, actor.role, reason, note],
    );
    await db.query(`UPDATE bookings SET status = 'CANCELLED' WHERE id = $1`, [id]);
  });
}

export async function addReview(actor: Actor, input: { bookingId: string; rating: number; comment: string; imageUrl?: string }) {
  return withActor(actor, async (db) => {
    const booking = await db.query(`SELECT provider_id, service_id FROM bookings WHERE id = $1`, [input.bookingId]);
    if (!booking.rows[0]) throw new Error('Pesanan tidak ditemukan.');
    const review = await db.query(
      `INSERT INTO reviews (booking_id, customer_id, provider_id, service_id, rating, comment) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [input.bookingId, actor.id, booking.rows[0].provider_id, booking.rows[0].service_id, input.rating, input.comment],
    );
    if (input.imageUrl) await db.query(`INSERT INTO review_images (review_id, image_url) VALUES ($1,$2)`, [review.rows[0].id, input.imageUrl]);
  });
}

export async function toggleFavorite(actor: Actor, providerId: string) {
  return withActor(actor, async (db) => {
    const existing = await db.query(`DELETE FROM favorites WHERE customer_id = $1 AND provider_id = $2 RETURNING provider_id`, [actor.id, providerId]);
    if (existing.rows[0]) return false;
    await db.query(`INSERT INTO favorites (customer_id, provider_id) VALUES ($1,$2)`, [actor.id, providerId]);
    return true;
  });
}

export async function listFavorites(actor: Actor) {
  return withActor(actor, async (db) => {
    const { rows } = await db.query(
      `SELECT p.id, p.slug, p.business_name, p.city, p.cover_url, c.name AS category_name
       FROM favorites f JOIN provider_profiles p ON p.id = f.provider_id LEFT JOIN categories c ON c.id = p.category_id
       WHERE f.customer_id = $1 ORDER BY f.created_at DESC`,
      [actor.id],
    );
    return rows;
  });
}

export async function toggleCompare(actor: Actor, serviceId: string) {
  return withActor(actor, async (db) => {
    const existing = await db.query(`DELETE FROM comparisons WHERE user_id = $1 AND service_id = $2 RETURNING service_id`, [actor.id, serviceId]);
    if (existing.rows[0]) return 'removed' as const;
    await db.query(`INSERT INTO comparisons (user_id, service_id) VALUES ($1,$2)`, [actor.id, serviceId]);
    return 'added' as const;
  });
}

export async function clearCompare(actor: Actor) {
  await withActor(actor, (db) => db.query(`DELETE FROM comparisons WHERE user_id = $1`, [actor.id]));
}

export async function listThreads(actor: Actor) {
  return withActor(actor, async (db) => {
    const { rows } = await db.query(
      `SELECT t.id, b.code, b.id AS booking_id, s.name AS service_name, p.business_name, c.full_name AS customer_name,
              (SELECT body FROM chat_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_body,
              (SELECT count(*)::int FROM chat_messages m WHERE m.thread_id = t.id AND m.sender_id <> $1 AND m.read_at IS NULL) AS unread
       FROM chat_threads t
       JOIN bookings b ON b.id = t.booking_id
       JOIN services s ON s.id = b.service_id
       JOIN provider_profiles p ON p.id = b.provider_id
       JOIN profiles c ON c.id = b.customer_id
       ORDER BY COALESCE((SELECT max(created_at) FROM chat_messages m WHERE m.thread_id = t.id), t.created_at) DESC`,
      [actor.id],
    );
    return rows;
  });
}

export async function threadMessages(actor: Actor, threadId: string) {
  return withActor(actor, async (db) => {
    await db.query(`UPDATE chat_messages SET read_at = now() WHERE thread_id = $1 AND sender_id <> $2 AND read_at IS NULL`, [threadId, actor.id]);
    const thread = await db.query(
      `SELECT t.id, b.code, b.status, s.name AS service_name FROM chat_threads t JOIN bookings b ON b.id = t.booking_id JOIN services s ON s.id = b.service_id WHERE t.id = $1`,
      [threadId],
    );
    const messages = await db.query(
      `SELECT m.id, m.body, m.created_at, m.sender_id, m.read_at, p.full_name FROM chat_messages m JOIN profiles p ON p.id = m.sender_id WHERE m.thread_id = $1 ORDER BY m.created_at`,
      [threadId],
    );
    const typing = await db.query(`SELECT user_id FROM chat_presence WHERE thread_id = $1 AND user_id <> $2 AND typing_until > now()`, [threadId, actor.id]);
    return { thread: thread.rows[0] || null, messages: messages.rows, typing: typing.rows.length > 0 };
  });
}

export async function sendMessage(actor: Actor, threadId: string, body: string) {
  return withActor(actor, async (db) => {
    const inserted = await db.query(`INSERT INTO chat_messages (thread_id, sender_id, body) VALUES ($1,$2,$3) RETURNING id`, [threadId, actor.id, body.trim()]);
    const peers = await db.query(
      `SELECT CASE WHEN b.customer_id = $2 THEN pr.user_id ELSE b.customer_id END AS peer
       FROM chat_threads t JOIN bookings b ON b.id = t.booking_id JOIN provider_profiles pr ON pr.id = b.provider_id
       WHERE t.id = $1`,
      [threadId, actor.id],
    );
    if (peers.rows[0]?.peer) {
      await db.query(`SELECT notify_user($1, 'chat', 'Pesan baru', $2, 'chat', $3::uuid)`, [peers.rows[0].peer, body.trim().slice(0, 140), threadId]);
    }
    return inserted.rows[0];
  });
}

export async function setTyping(actor: Actor, threadId: string) {
  await withActor(actor, (db) =>
    db.query(
      `INSERT INTO chat_presence (thread_id, user_id, typing_until) VALUES ($1,$2, now() + interval '4 seconds')
       ON CONFLICT (thread_id, user_id) DO UPDATE SET typing_until = EXCLUDED.typing_until`,
      [threadId, actor.id],
    ),
  );
}

export async function notificationsFor(actor: Actor) {
  return withActor(actor, async (db) => {
    const { rows } = await db.query(`SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 40`, [actor.id]);
    return rows;
  });
}

export async function unreadCount(actor: Actor) {
  return withActor(actor, async (db) => {
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`, [actor.id]);
    return rows[0].n as number;
  });
}

export async function markNotifications(actor: Actor, id?: string) {
  await withActor(actor, (db) =>
    id
      ? db.query(`UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2`, [id, actor.id])
      : db.query(`UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`, [actor.id]),
  );
}

export async function createComplaint(actor: Actor, input: { bookingId: string; category: string; title: string; description: string; expected: string; fileUrl?: string }) {
  return withActor(actor, async (db) => {
    const booking = await db.query(`SELECT customer_id, provider_id FROM bookings WHERE id = $1`, [input.bookingId]);
    if (!booking.rows[0]) throw new Error('Pesanan tidak ditemukan.');
    const against = actor.role === 'provider' ? 'customer' : 'provider';
    const { rows } = await db.query(
      `INSERT INTO complaints (booking_id, opened_by, against_role, category, title, description, expected_solution) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [input.bookingId, actor.id, against, input.category, input.title, input.description, input.expected],
    );
    if (input.fileUrl) await db.query(`INSERT INTO complaint_attachments (complaint_id, file_url) VALUES ($1,$2)`, [rows[0].id, input.fileUrl]);
    const admins = await db.query(`SELECT id FROM profiles WHERE role = 'admin'`);
    for (const admin of admins.rows) {
      await db.query(`SELECT notify_user($1, 'complaint', 'Komplain baru', $2, 'complaint', $3)`, [admin.id, input.title, rows[0].id]);
    }
    return rows[0].id as string;
  });
}

export async function listComplaints(actor: Actor) {
  return withActor(actor, async (db) => (await db.query(
    `SELECT c.*, b.code, p.full_name AS opener_name FROM complaints c JOIN bookings b ON b.id = c.booking_id JOIN profiles p ON p.id = c.opened_by ORDER BY c.created_at DESC LIMIT 100`,
  )).rows);
}

export async function complaintDetail(actor: Actor, id: string) {
  return withActor(actor, async (db) => {
    const complaint = await db.query(`SELECT c.*, b.code FROM complaints c JOIN bookings b ON b.id = c.booking_id WHERE c.id = $1`, [id]);
    if (!complaint.rows[0]) return null;
    const messages = await db.query(`SELECT m.body, m.created_at, p.full_name, p.role FROM complaint_messages m JOIN profiles p ON p.id = m.sender_id WHERE m.complaint_id = $1 ORDER BY m.created_at`, [id]);
    const files = await db.query(`SELECT file_url FROM complaint_attachments WHERE complaint_id = $1`, [id]);
    return { complaint: complaint.rows[0], messages: messages.rows, files: files.rows };
  });
}

export async function addComplaintMessage(actor: Actor, id: string, body: string) {
  await withActor(actor, (db) => db.query(`INSERT INTO complaint_messages (complaint_id, sender_id, body) VALUES ($1,$2,$3)`, [id, actor.id, body.trim()]));
}

export async function setComplaintStatus(actor: Actor, id: string, status: string) {
  await withActor(actor, async (db) => {
    const before = await db.query(`SELECT status FROM complaints WHERE id = $1`, [id]);
    await db.query(`UPDATE complaints SET status = $2 WHERE id = $1`, [id, status]);
    await db.query(`INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, before_data, after_data) VALUES ($1, 'complaint_status', 'complaint', $2, $3, $4)`, [actor.id, id, JSON.stringify(before.rows[0] || {}), JSON.stringify({ status })]);
  });
}

export async function myProvider(actor: Actor) {
  return withActor(actor, async (db) => (await db.query(`SELECT * FROM provider_profiles WHERE user_id = $1`, [actor.id])).rows[0] || null);
}

export async function providerServices(actor: Actor) {
  const provider = await myProvider(actor);
  if (!provider) return [];
  return withActor(actor, async (db) => (await db.query(
    `SELECT s.*, COALESCE(json_agg(json_build_object('id', pk.id, 'name', pk.name, 'description', pk.description, 'price', pk.price, 'durationMin', pk.duration_min, 'active', pk.is_active) ORDER BY pk.sort_order) FILTER (WHERE pk.id IS NOT NULL), '[]') AS packages
     FROM services s LEFT JOIN service_price_packages pk ON pk.service_id = s.id
     WHERE s.provider_id = $1 GROUP BY s.id ORDER BY s.created_at DESC`,
    [provider.id],
  )).rows);
}

export async function saveService(actor: Actor, input: { id?: string; name: string; categoryId: string; description: string; duration: number; method: string; active: boolean }) {
  const provider = await myProvider(actor);
  if (!provider) throw new Error('Profil mitra tidak ditemukan.');
  return withActor(actor, async (db) => {
    if (input.id) {
      await db.query(
        `UPDATE services SET name=$2, category_id=$3, description=$4, duration_min=$5, service_method=$6, is_active=$7 WHERE id=$1 AND provider_id=$8`,
        [input.id, input.name, input.categoryId, input.description, input.duration, input.method, input.active, provider.id],
      );
      return input.id;
    }
    const { rows } = await db.query(
      `INSERT INTO services (provider_id, category_id, name, slug, description, min_price, max_price, duration_min, service_method, is_active)
       VALUES ($1,$2,$3,$4,$5,0,0,$6,$7,$8) RETURNING id`,
      [provider.id, input.categoryId, input.name, slugify(input.name) + '-' + Date.now().toString().slice(-4), input.description, input.duration, input.method, input.active],
    );
    return rows[0].id as string;
  });
}

export async function archiveService(actor: Actor, id: string) {
  const provider = await myProvider(actor);
  await withActor(actor, (db) => db.query(`UPDATE services SET archived_at = now(), is_active = false WHERE id = $1 AND provider_id = $2`, [id, provider.id]));
}

export async function savePackage(actor: Actor, input: { id?: string; serviceId: string; name: string; description: string; price: number; duration: number; active: boolean }) {
  await withActor(actor, async (db) => {
    if (input.id) {
      await db.query(`UPDATE service_price_packages SET name=$2, description=$3, price=$4, duration_min=$5, is_active=$6 WHERE id=$1`, [input.id, input.name, input.description, input.price, input.duration, input.active]);
    } else {
      await db.query(`INSERT INTO service_price_packages (service_id, name, description, price, duration_min, is_active) VALUES ($1,$2,$3,$4,$5,$6)`, [input.serviceId, input.name, input.description, input.price, input.duration, input.active]);
    }
    await db.query(
      `UPDATE services SET min_price = COALESCE((SELECT min(price) FROM service_price_packages WHERE service_id = $1 AND is_active), 0),
        max_price = COALESCE((SELECT max(price) FROM service_price_packages WHERE service_id = $1 AND is_active), 0) WHERE id = $1`,
      [input.serviceId],
    );
  });
}

export async function addPortfolio(actor: Actor, input: { serviceId?: string; imageUrl: string; caption: string }) {
  const provider = await myProvider(actor);
  await withActor(actor, (db) => db.query(`INSERT INTO portfolios (provider_id, service_id, image_url, caption, sort_order) VALUES ($1,$2,$3,$4, (SELECT COALESCE(max(sort_order),0)+1 FROM portfolios WHERE provider_id = $1))`, [provider.id, input.serviceId || null, input.imageUrl, input.caption]));
}

export async function deletePortfolio(actor: Actor, id: string) {
  const provider = await myProvider(actor);
  await withActor(actor, (db) => db.query(`DELETE FROM portfolios WHERE id = $1 AND provider_id = $2`, [id, provider.id]));
}

export async function listPortfolio(actor: Actor) {
  const provider = await myProvider(actor);
  if (!provider) return [];
  return withActor(actor, async (db) => (await db.query(`SELECT * FROM portfolios WHERE provider_id = $1 ORDER BY sort_order`, [provider.id])).rows);
}

export async function updateProviderProfile(actor: Actor, input: Record<string, string | number>) {
  const provider = await myProvider(actor);
  await withActor(actor, (db) =>
    db.query(
      `UPDATE provider_profiles SET business_name=$2, description=$3, phone=$4, business_email=$5, address=$6, city=$7, lat=$8, lng=$9, service_radius_km=$10, service_method=$11, cover_url=COALESCE($12, cover_url) WHERE id=$1`,
      [provider.id, input.businessName, input.description, input.phone, input.businessEmail, input.address, input.city, input.lat, input.lng, input.radius, input.method, input.coverUrl || null],
    ),
  );
}

export async function saveHours(actor: Actor, rows: { weekday: number; start: string; end: string; active: boolean }[]) {
  const provider = await myProvider(actor);
  await withActor(actor, async (db) => {
    for (const row of rows) {
      await db.query(
        `INSERT INTO provider_availability (provider_id, weekday, start_time, end_time, is_active) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (provider_id, weekday) DO UPDATE SET start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, is_active = EXCLUDED.is_active`,
        [provider.id, row.weekday, row.start, row.end, row.active],
      );
    }
  });
}

export async function listHours(actor: Actor) {
  const provider = await myProvider(actor);
  if (!provider) return [];
  return withActor(actor, async (db) => (await db.query(`SELECT weekday, start_time::text, end_time::text, is_active FROM provider_availability WHERE provider_id = $1 ORDER BY weekday`, [provider.id])).rows);
}

export async function saveBank(actor: Actor, input: { bankName: string; accountNumber: string; accountHolder: string; evidenceUrl?: string }) {
  const provider = await myProvider(actor);
  return withActor(actor, async (db) => {
    const { rows } = await db.query(
      `INSERT INTO provider_bank_accounts (provider_id, bank_name, account_number, account_holder, evidence_url, status) VALUES ($1,$2,$3,$4,$5,'PENDING') RETURNING id`,
      [provider.id, input.bankName, input.accountNumber, input.accountHolder, input.evidenceUrl || null],
    );
    const admins = await db.query(`SELECT id FROM profiles WHERE role = 'admin'`);
    for (const admin of admins.rows) await db.query(`SELECT notify_user($1,'bank_request','Verifikasi rekening','Ada rekening mitra yang menunggu peninjauan.','bank',$2)`, [admin.id, rows[0].id]);
    return rows[0].id as string;
  });
}

export async function listBanks(actor: Actor, all = false) {
  return withActor(actor, async (db) => {
    if (all && actor.role === 'admin') return (await db.query(`SELECT b.*, p.business_name FROM provider_bank_accounts b JOIN provider_profiles p ON p.id = b.provider_id ORDER BY b.created_at DESC`)).rows;
    const provider = await myProvider(actor);
    if (!provider) return [];
    return (await db.query(`SELECT * FROM provider_bank_accounts WHERE provider_id = $1 ORDER BY created_at DESC`, [provider.id])).rows;
  });
}

export async function pushLocation(actor: Actor, bookingId: string, lat: number, lng: number) {
  const provider = await myProvider(actor);
  await withActor(actor, (db) => db.query(`INSERT INTO provider_locations (provider_id, booking_id, lat, lng) VALUES ($1,$2,$3,$4)`, [provider.id, bookingId, lat, lng]));
}

export async function dashboardCustomer(actor: Actor) {
  return withActor(actor, async (db) => {
    const stats = await db.query(
      `SELECT
         count(*) FILTER (WHERE status IN ('WAITING_APPROVAL','ACCEPTED','CONFIRMED','PROVIDER_ON_THE_WAY','ARRIVED','ON_PROGRESS','DISPUTED'))::int AS active,
         count(*) FILTER (WHERE status = 'COMPLETED')::int AS done,
         (SELECT count(*)::int FROM favorites WHERE customer_id = $1) AS favorites,
         (SELECT count(*)::int FROM complaints c JOIN bookings b ON b.id = c.booking_id WHERE b.customer_id = $1 AND c.status IN ('OPEN','UNDER_REVIEW','NEED_MORE_INFO')) AS complaints
       FROM bookings WHERE customer_id = $1`,
      [actor.id],
    );
    return stats.rows[0];
  });
}

export async function dashboardProvider(actor: Actor) {
  const provider = await myProvider(actor);
  if (!provider) return null;
  return withActor(actor, async (db) => {
    const stats = await db.query(
      `SELECT
         count(*) FILTER (WHERE status = 'WAITING_APPROVAL')::int AS incoming,
         count(*) FILTER (WHERE status IN ('ACCEPTED','CONFIRMED','PROVIDER_ON_THE_WAY','ARRIVED','ON_PROGRESS'))::int AS active,
         count(*) FILTER (WHERE status = 'COMPLETED')::int AS done,
         COALESCE(sum(amount) FILTER (WHERE status = 'COMPLETED'), 0)::int AS earnings
       FROM bookings WHERE provider_id = $1`,
      [provider.id],
    );
    const rating = await db.query(`SELECT COALESCE(round(avg(rating)::numeric, 2), 0) AS rating, count(*)::int AS reviews FROM reviews WHERE provider_id = $1 AND hidden_at IS NULL`, [provider.id]);
    return { provider, ...stats.rows[0], ...rating.rows[0] };
  });
}

export async function adminStats() {
  return withActor({ role: 'admin', id: '' }, async (db) => {
    // admin policies need a real admin id for some checks; role admin is enough for app_role().
    const kpi = await db.query(`
      SELECT
        (SELECT count(*)::int FROM profiles) AS users,
        (SELECT count(*)::int FROM profiles WHERE role = 'customer') AS customers,
        (SELECT count(*)::int FROM provider_profiles WHERE status = 'VERIFIED' AND deleted_at IS NULL) AS providers,
        (SELECT count(*)::int FROM provider_profiles WHERE status IN ('SUBMITTED','UNDER_REVIEW')) AS pending_providers,
        (SELECT count(*)::int FROM bookings WHERE booking_date = (now() AT TIME ZONE 'Asia/Jakarta')::date) AS bookings_today,
        (SELECT count(*)::int FROM bookings WHERE created_at >= date_trunc('month', now())) AS bookings_month,
        (SELECT count(*)::int FROM bookings WHERE status IN ('WAITING_APPROVAL','ACCEPTED','CONFIRMED','PROVIDER_ON_THE_WAY','ARRIVED','ON_PROGRESS','DISPUTED')) AS active_tx,
        (SELECT count(*)::int FROM bookings WHERE status = 'COMPLETED') AS completed_tx,
        (SELECT count(*)::int FROM bookings WHERE status = 'CANCELLED') AS cancelled_tx,
        (SELECT count(*)::int FROM complaints WHERE status IN ('OPEN','UNDER_REVIEW','NEED_MORE_INFO')) AS open_complaints,
        (SELECT COALESCE(sum(amount),0)::bigint FROM bookings WHERE status = 'COMPLETED') AS value
    `);
    const daily = await db.query(`SELECT to_char(created_at AT TIME ZONE 'Asia/Jakarta', 'DD Mon') AS label, count(*)::int AS count FROM bookings WHERE created_at > now() - interval '14 days' GROUP BY 1, date_trunc('day', created_at) ORDER BY date_trunc('day', created_at)`);
    const byCategory = await db.query(`SELECT c.name, count(p.id)::int AS count FROM categories c LEFT JOIN provider_profiles p ON p.category_id = c.id AND p.deleted_at IS NULL GROUP BY c.name, c.sort_order ORDER BY c.sort_order`);
    const byStatus = await db.query(`SELECT status, count(*)::int AS count FROM bookings GROUP BY status ORDER BY count DESC`);
    return { kpi: kpi.rows[0], daily: daily.rows, byCategory: byCategory.rows, byStatus: byStatus.rows };
  });
}

export async function adminList(kind: string) {
  return withActor({ role: 'admin' }, async (db) => {
    if (kind === 'customers') return (await db.query(`SELECT id, full_name, email, phone, email_verified_at, phone_verified_at, created_at FROM profiles WHERE role = 'customer' ORDER BY created_at DESC`)).rows;
    if (kind === 'providers') return (await db.query(`SELECT p.*, c.name AS category_name, u.email, u.full_name FROM provider_profiles p LEFT JOIN categories c ON c.id = p.category_id JOIN profiles u ON u.id = p.user_id ORDER BY p.created_at DESC`)).rows;
    if (kind === 'services') return (await db.query(`SELECT s.*, p.business_name, c.name AS category_name FROM services s JOIN provider_profiles p ON p.id = s.provider_id JOIN categories c ON c.id = s.category_id ORDER BY s.created_at DESC`)).rows;
    if (kind === 'bookings') return (await db.query(`SELECT b.*, s.name AS service_name, p.business_name, c.full_name AS customer_name, pay.status AS payment_status, EXISTS (SELECT 1 FROM complaints k WHERE k.booking_id = b.id) AS has_complaint FROM bookings b JOIN services s ON s.id = b.service_id JOIN provider_profiles p ON p.id = b.provider_id JOIN profiles c ON c.id = b.customer_id LEFT JOIN payments pay ON pay.booking_id = b.id ORDER BY b.created_at DESC LIMIT 200`)).rows;
    if (kind === 'cancellations') return (await db.query(`SELECT k.*, b.code, p.full_name FROM booking_cancellations k JOIN bookings b ON b.id = k.booking_id JOIN profiles p ON p.id = k.cancelled_by ORDER BY k.cancelled_at DESC`)).rows;
    if (kind === 'reviews') return (await db.query(`SELECT r.*, p.full_name, pr.business_name, b.code FROM reviews r JOIN profiles p ON p.id = r.customer_id JOIN provider_profiles pr ON pr.id = r.provider_id JOIN bookings b ON b.id = r.booking_id ORDER BY r.created_at DESC`)).rows;
    if (kind === 'audit') return (await db.query(`SELECT a.*, p.full_name FROM audit_logs a LEFT JOIN profiles p ON p.id = a.admin_id ORDER BY a.created_at DESC LIMIT 100`)).rows;
    if (kind === 'highlights') return (await db.query(`SELECT h.*, p.business_name FROM highlights h JOIN provider_profiles p ON p.id = h.provider_id ORDER BY h.sort_order`)).rows;
    if (kind === 'carousel') return (await db.query(`SELECT * FROM homepage_carousels ORDER BY sort_order`)).rows;
    if (kind === 'notifications') return (await db.query(`SELECT n.*, p.full_name FROM notifications n JOIN profiles p ON p.id = n.user_id ORDER BY n.created_at DESC LIMIT 50`)).rows;
    if (kind === 'locations') return (await db.query(`SELECT DISTINCT ON (l.provider_id) l.lat, l.lng, l.recorded_at, p.business_name, b.code, b.status FROM provider_locations l JOIN provider_profiles p ON p.id = l.provider_id JOIN bookings b ON b.id = l.booking_id WHERE b.status = 'PROVIDER_ON_THE_WAY' ORDER BY l.provider_id, l.recorded_at DESC`)).rows;
    return [];
  });
}

export async function setProviderStatus(admin: Actor, providerId: string, status: string, note: string) {
  await withActor(admin, async (db) => {
    const before = await db.query(`SELECT status FROM provider_profiles WHERE id = $1`, [providerId]);
    await db.query(`UPDATE provider_profiles SET status = $2, verified_at = CASE WHEN $2 = 'VERIFIED' THEN now() ELSE verified_at END, rejection_note = $3, deleted_at = CASE WHEN $2 = 'SUSPENDED' THEN COALESCE(deleted_at, now()) WHEN $2 = 'VERIFIED' THEN NULL ELSE deleted_at END WHERE id = $1`, [providerId, status, note]);
    await db.query(`INSERT INTO provider_verifications (provider_id, status, note, reviewed_by) VALUES ($1,$2,$3,$4)`, [providerId, status, note, admin.id]);
    await db.query(`INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, before_data, after_data) VALUES ($1,$2,'provider',$3,$4,$5)`, [admin.id, `provider_${status.toLowerCase()}`, providerId, JSON.stringify(before.rows[0] || {}), JSON.stringify({ status, note })]);
    const owner = await db.query(`SELECT user_id, business_name FROM provider_profiles WHERE id = $1`, [providerId]);
    if (owner.rows[0]) await db.query(`SELECT notify_user($1, 'provider_verification', 'Status mitra diperbarui', $2, 'provider', $3)`, [owner.rows[0].user_id, `${owner.rows[0].business_name}: ${status}. ${note}`, providerId]);
  });
}

export async function setBankStatus(admin: Actor, id: string, status: string) {
  await withActor(admin, async (db) => {
    await db.query(`UPDATE provider_bank_accounts SET status = $2 WHERE id = $1`, [id, status]);
    const row = await db.query(`SELECT b.provider_id, p.user_id FROM provider_bank_accounts b JOIN provider_profiles p ON p.id = b.provider_id WHERE b.id = $1`, [id]);
    if (row.rows[0]) await db.query(`SELECT notify_user($1, $2, $3, $4, 'bank', $5)`, [row.rows[0].user_id, status === 'VERIFIED' ? 'bank_approved' : 'bank_rejected', 'Rekening', status === 'VERIFIED' ? 'Rekening Anda terverifikasi.' : 'Rekening ditolak. Periksa data dan kirim ulang.', id]);
    await db.query(`INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, after_data) VALUES ($1, 'bank_status', 'bank', $2, $3)`, [admin.id, id, JSON.stringify({ status })]);
  });
}

export async function hideReview(admin: Actor, id: string, hide: boolean) {
  await withActor(admin, async (db) => {
    await db.query(`UPDATE reviews SET hidden_at = CASE WHEN $2 THEN now() ELSE NULL END WHERE id = $1`, [id, hide]);
    await db.query(`INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, after_data) VALUES ($1, 'review_moderation', 'review', $2, $3)`, [admin.id, id, JSON.stringify({ hidden: hide })]);
  });
}

export async function saveHighlight(admin: Actor, input: { id?: string; providerId: string; headline: string; subtitle: string; banner: string; cta: string; active: boolean }) {
  await withActor(admin, async (db) => {
    if (input.id) {
      await db.query(`UPDATE highlights SET provider_id=$2, headline=$3, subtitle=$4, banner_url=$5, cta_label=$6, is_active=$7 WHERE id=$1`, [input.id, input.providerId, input.headline, input.subtitle, input.banner, input.cta, input.active]);
    } else {
      await db.query(`INSERT INTO highlights (provider_id, headline, subtitle, banner_url, cta_label, is_active, sort_order) VALUES ($1,$2,$3,$4,$5,$6, (SELECT COALESCE(max(sort_order),0)+1 FROM highlights))`, [input.providerId, input.headline, input.subtitle, input.banner, input.cta, input.active]);
    }
    await db.query(`INSERT INTO audit_logs (admin_id, action, entity_type, after_data) VALUES ($1, 'highlight_saved', 'highlight', $2)`, [admin.id, JSON.stringify({ headline: input.headline })]);
  });
}

export async function reorderHighlights(admin: Actor, ids: string[]) {
  await withActor(admin, async (db) => {
    for (let index = 0; index < ids.length; index += 1) {
      await db.query(`UPDATE highlights SET sort_order = $2 WHERE id = $1`, [ids[index], index + 1]);
    }
  });
}

export async function deleteHighlight(admin: Actor, id: string) {
  await withActor(admin, (db) => db.query(`DELETE FROM highlights WHERE id = $1`, [id]));
}

export async function saveCarousel(admin: Actor, input: { id?: string; title: string; subtitle: string; image: string; link: string; active: boolean }) {
  await withActor(admin, async (db) => {
    if (input.id) await db.query(`UPDATE homepage_carousels SET title=$2, subtitle=$3, image_url=$4, link=$5, is_active=$6 WHERE id=$1`, [input.id, input.title, input.subtitle, input.image, input.link, input.active]);
    else await db.query(`INSERT INTO homepage_carousels (title, subtitle, image_url, link, is_active, sort_order) VALUES ($1,$2,$3,$4,$5, (SELECT COALESCE(max(sort_order),0)+1 FROM homepage_carousels))`, [input.title, input.subtitle, input.image, input.link, input.active]);
  });
}

export async function deleteCarousel(admin: Actor, id: string) {
  await withActor(admin, (db) => db.query(`DELETE FROM homepage_carousels WHERE id = $1`, [id]));
}

export async function saveCategory(admin: Actor, input: { id?: string; name: string; icon: string; active: boolean }) {
  await withActor(admin, async (db) => {
    if (input.id) await db.query(`UPDATE categories SET name=$2, icon=$3, is_active=$4 WHERE id=$1`, [input.id, input.name, input.icon, input.active]);
    else await db.query(`INSERT INTO categories (name, slug, icon, is_active, sort_order) VALUES ($1,$2,$3,$4, (SELECT COALESCE(max(sort_order),0)+1 FROM categories))`, [input.name, slugify(input.name), input.icon, input.active]);
  });
}

export async function moveCategory(admin: Actor, id: string, direction: -1 | 1) {
  await withActor(admin, async (db) => {
    const { rows } = await db.query(`SELECT id, sort_order FROM categories ORDER BY sort_order, name`);
    const index = rows.findIndex((row) => row.id === id);
    const swap = rows[index + direction];
    if (!rows[index] || !swap) return;
    await db.query(`UPDATE categories SET sort_order = $2 WHERE id = $1`, [rows[index].id, swap.sort_order]);
    await db.query(`UPDATE categories SET sort_order = $2 WHERE id = $1`, [swap.id, rows[index].sort_order]);
  });
}

export async function saveSetting(admin: Actor, requirePhone: boolean) {
  await withActor(admin, (db) => db.query(`UPDATE app_settings SET value = jsonb_set(value, '{requirePhone}', $1::jsonb), updated_at = now() WHERE key = 'booking'`, [JSON.stringify(requirePhone)]));
}

export async function getSettings() {
  return withActor({ role: 'anon' }, async (db) => (await db.query(`SELECT key, value FROM app_settings`)).rows);
}

export async function createSupport(input: { name: string; email: string; message: string }) {
  await withActor({ role: 'anon' }, (db) => db.query(`INSERT INTO support_requests (name, email, message) VALUES ($1,$2,$3)`, [input.name, input.email, input.message]));
}

export async function realtimeSnapshot(actor: Actor, since: string) {
  return withActor(actor, async (db) => {
    const notes = await db.query(`SELECT id, type, title, message, entity_type, entity_id, created_at FROM notifications WHERE user_id = $1 AND created_at > $2 ORDER BY created_at`, [actor.id, since]);
    const messages = await db.query(
      `SELECT m.id, m.thread_id, m.body, m.created_at, m.sender_id FROM chat_messages m
       JOIN chat_threads t ON t.id = m.thread_id
       WHERE m.created_at > $2 AND m.sender_id <> $1
         AND EXISTS (SELECT 1 FROM bookings b JOIN provider_profiles p ON p.id = b.provider_id WHERE b.id = t.booking_id AND (b.customer_id = $1 OR p.user_id = $1))
       ORDER BY m.created_at`,
      [actor.id, since],
    );
    const locations = await db.query(
      `SELECT l.booking_id, l.lat, l.lng, l.recorded_at FROM provider_locations l
       JOIN bookings b ON b.id = l.booking_id
       WHERE l.recorded_at > $2 AND (b.customer_id = $1 OR b.provider_id = my_provider_id() OR $3 = 'admin')
       ORDER BY l.recorded_at DESC LIMIT 20`,
      [actor.id, since, actor.role],
    );
    await db.query(`UPDATE profiles SET last_seen_at = now() WHERE id = $1`, [actor.id]);
    return { notifications: notes.rows, messages: messages.rows, locations: locations.rows };
  });
}
