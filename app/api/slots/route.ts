import { NextResponse } from 'next/server';
import { slotsFor } from '@/lib/catalog';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const providerId = url.searchParams.get('provider') || '';
  const date = url.searchParams.get('date') || '';
  if (!providerId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Parameter tidak lengkap.' }, { status: 400 });
  const slots = await slotsFor(providerId, date);
  return NextResponse.json({ slots });
}
