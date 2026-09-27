import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getActor } from '@/lib/session';
import { serviceSupabase } from '@/lib/supabase';

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

export async function POST(request: Request) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: 'Silakan masuk.' }, { status: 401 });
  const form = await request.formData();
  const file = form.get('file');
  const bucket = String(form.get('bucket') || 'avatars');
  if (!(file instanceof File)) return NextResponse.json({ error: 'File wajib diisi.' }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: 'Tipe file tidak didukung.' }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Ukuran file maksimal 5 MB.' }, { status: 400 });
  if (!['avatars', 'provider-covers', 'portfolios', 'complaint-evidence', 'review-images', 'bank-verification'].includes(bucket)) {
    return NextResponse.json({ error: 'Folder tidak dikenal.' }, { status: 400 });
  }
  const name = `${randomUUID()}.${ext}`;
  const supabase = serviceSupabase();
  if (supabase) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const objectPath = `${actor.id}/${name}`;
    const { error } = await supabase.storage.from(bucket).upload(objectPath, bytes, { contentType: file.type, upsert: false });
    if (error) return NextResponse.json({ error: 'Unggahan gagal. Periksa bucket Supabase.' }, { status: 400 });
    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    return NextResponse.json({ url: data.publicUrl });
  }
  const dir = path.join(process.cwd(), 'public', 'uploads', bucket, actor.id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ url: `/uploads/${bucket}/${actor.id}/${name}` });
}
