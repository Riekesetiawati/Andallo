import { NextResponse } from 'next/server';
import { withActor } from '@/lib/db';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const expired = await withActor({ role: 'system' }, async (db) => (await db.query('SELECT expire_bookings() AS n')).rows[0].n);
  return NextResponse.json({ expired });
}
