import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';

process.env.DATABASE_URL ||= 'postgres://andallo_app:andallo_dev@127.0.0.1:5432/andallo';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function scenario(role, userId, fn) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query(`SELECT set_config('app.user_id', $1, true), set_config('app.role', $2, true)`, [userId || '', role]);
    await fn(db);
  } finally {
    await db.query('ROLLBACK');
    db.release();
  }
}

test('catalog search, category, price, and distance come from Postgres', async () => {
  await scenario('anon', '', async (db) => {
    const all = await db.query(`SELECT count(*)::int AS n FROM services s JOIN provider_profiles p ON p.id = s.provider_id WHERE p.status = 'VERIFIED'`);
    assert.ok(all.rows[0].n >= 35);
    const cleaning = await db.query(`SELECT count(*)::int AS n FROM services s JOIN categories c ON c.id = s.category_id WHERE c.slug = 'kebersihan'`);
    assert.equal(cleaning.rows[0].n, 5);
    const cheap = await db.query(`SELECT count(*)::int AS n FROM services WHERE min_price BETWEEN 25000 AND 80000`);
    assert.ok(cheap.rows[0].n >= 1);
    const near = await db.query(
      `SELECT business_name, round(ST_Distance(location, ST_SetSRID(ST_MakePoint(106.9756, -6.2383), 4326)::geography)::numeric, 0) AS meters
       FROM provider_profiles WHERE status = 'VERIFIED' ORDER BY location <-> ST_SetSRID(ST_MakePoint(106.9756, -6.2383), 4326)::geography LIMIT 1`,
    );
    assert.ok(Number(near.rows[0].meters) < 30000);
    const again = await db.query(
      `SELECT round(ST_Distance(location, ST_SetSRID(ST_MakePoint(106.9756, -6.2383), 4326)::geography)::numeric, 0) AS meters
       FROM provider_profiles WHERE business_name = $1`,
      [near.rows[0].business_name],
    );
    assert.equal(Number(again.rows[0].meters), Number(near.rows[0].meters));
  });
});

test('anonymous users cannot read private profiles', async () => {
  await scenario('anon', '', async (db) => {
    const rows = await db.query(`SELECT email FROM profiles`);
    assert.equal(rows.rows.length, 0);
  });
});

test('double booking of the same slot is rejected', async () => {
  await scenario('customer', '11111111-1111-4111-8111-111111111111', async (db) => {
    const slot = await db.query(
      `SELECT s.id AS service_id, s.provider_id, pk.id AS package_id
       FROM services s JOIN service_price_packages pk ON pk.service_id = s.id
       WHERE s.is_active LIMIT 1`,
    );
    const row = slot.rows[0];
    const insert = `INSERT INTO bookings (customer_id, provider_id, service_id, package_id, booking_date, time_slot, address, service_method)
      VALUES ('11111111-1111-4111-8111-111111111111', $1, $2, $3, '2031-06-16', '10:00', 'Alamat uji coba', 'HOME_SERVICE')`;
    await db.query(insert, [row.provider_id, row.service_id, row.package_id]);
    await db.query('SAVEPOINT slot_guard');
    await assert.rejects(() => db.query(insert, [row.provider_id, row.service_id, row.package_id]));
    await db.query('ROLLBACK TO SAVEPOINT slot_guard');
  });
});

test('reviews are allowed only after a completed booking', async () => {
  await scenario('customer', '11111111-1111-4111-8111-111111111111', async (db) => {
    const open = await db.query(`SELECT id, provider_id, service_id FROM bookings WHERE customer_id = '11111111-1111-4111-8111-111111111111' AND status <> 'COMPLETED' LIMIT 1`);
    if (open.rows[0]) {
      await db.query('SAVEPOINT review_guard');
      await assert.rejects(() => db.query(
        `INSERT INTO reviews (booking_id, customer_id, provider_id, service_id, rating, comment) VALUES ($1,'11111111-1111-4111-8111-111111111111',$2,$3,5,'Terlalu cepat')`,
        [open.rows[0].id, open.rows[0].provider_id, open.rows[0].service_id],
      ));
      await db.query('ROLLBACK TO SAVEPOINT review_guard');
    }
    const done = await db.query(`SELECT id, provider_id, service_id FROM bookings WHERE code = 'ADL-9002'`);
    assert.ok(done.rows[0]);
    await db.query(
      `INSERT INTO reviews (booking_id, customer_id, provider_id, service_id, rating, comment) VALUES ($1,'11111111-1111-4111-8111-111111111111',$2,$3,5,'Layanan rapi dan tepat waktu.')`,
      [done.rows[0].id, done.rows[0].provider_id, done.rows[0].service_id],
    );
  });
});

test('comparison stays inside one category and three items', async () => {
  await scenario('customer', '11111111-1111-4111-8111-111111111111', async (db) => {
    const same = await db.query(`SELECT s.id FROM services s JOIN categories c ON c.id = s.category_id WHERE c.slug = 'perawatan' ORDER BY s.name LIMIT 4`);
    const other = await db.query(`SELECT s.id FROM services s JOIN categories c ON c.id = s.category_id WHERE c.slug = 'otomotif' LIMIT 1`);
    await db.query(`INSERT INTO comparisons (user_id, service_id) VALUES ('11111111-1111-4111-8111-111111111111', $1)`, [same.rows[0].id]);
    await db.query('SAVEPOINT compare_guard');
    await assert.rejects(() => db.query(`INSERT INTO comparisons (user_id, service_id) VALUES ('11111111-1111-4111-8111-111111111111', $1)`, [other.rows[0].id]));
    await db.query('ROLLBACK TO SAVEPOINT compare_guard');
    await db.query(`INSERT INTO comparisons (user_id, service_id) VALUES ('11111111-1111-4111-8111-111111111111', $1)`, [same.rows[1].id]);
    await db.query(`INSERT INTO comparisons (user_id, service_id) VALUES ('11111111-1111-4111-8111-111111111111', $1)`, [same.rows[2].id]);
    await db.query('SAVEPOINT compare_limit');
    await assert.rejects(() => db.query(`INSERT INTO comparisons (user_id, service_id) VALUES ('11111111-1111-4111-8111-111111111111', $1)`, [same.rows[3].id]));
    await db.query('ROLLBACK TO SAVEPOINT compare_limit');
  });
});

test('duplicate favorites are rejected', async () => {
  await scenario('customer', '11111111-1111-4111-8111-111111111111', async (db) => {
    const provider = await db.query(`SELECT id FROM provider_profiles WHERE status = 'VERIFIED' ORDER BY business_name LIMIT 1`);
    await db.query(`INSERT INTO favorites (customer_id, provider_id) VALUES ('11111111-1111-4111-8111-111111111111', $1) ON CONFLICT DO NOTHING`, [provider.rows[0].id]);
    await db.query('SAVEPOINT favorite_guard');
    await assert.rejects(() => db.query(`INSERT INTO favorites (customer_id, provider_id) VALUES ('11111111-1111-4111-8111-111111111111', $1)`, [provider.rows[0].id]));
    await db.query('ROLLBACK TO SAVEPOINT favorite_guard');
  });
});

test.after(async () => {
  await pool.end();
});
