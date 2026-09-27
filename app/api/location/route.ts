import { NextResponse } from 'next/server';
import { dbErrorMessage } from '@/lib/db';
import { pushLocation } from '@/lib/repo';
import { getActor } from '@/lib/session';

export async function POST(request: Request) {
  const actor = await getActor();
  if (!actor || actor.role !== 'provider') return NextResponse.json({ error: 'Hanya mitra.' }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body?.bookingId || typeof body.lat !== 'number' || typeof body.lng !== 'number') {
    return NextResponse.json({ error: 'Lokasi tidak lengkap.' }, { status: 400 });
  }
  try {
    await pushLocation(actor, body.bookingId, body.lat, body.lng);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: dbErrorMessage(error) }, { status: 400 });
  }
}
