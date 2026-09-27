'use client';

import { useActionState } from 'react';
import { complaintAction } from '@/app/actions';
import { UploadField } from './upload-field';

export function ComplaintForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(complaintAction, null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <label className="field">Kategori
        <select className="select" name="category" required>
          {['Keterlambatan', 'Kualitas layanan', 'Harga tidak sesuai', 'Komunikasi', 'Lainnya'].map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label className="field">Judul<input className="input" name="title" required minLength={4} /></label>
      <label className="field">Deskripsi<textarea className="input min-h-28" name="description" required minLength={10} /></label>
      <label className="field">Penyelesaian yang diharapkan<textarea className="input" name="expected" required minLength={3} /></label>
      <UploadField name="fileUrl" bucket="complaint-evidence" label="Bukti (opsional)" />
      {state?.error ? <p className="text-sm font-semibold text-red-700">{state.error}</p> : null}
      <button className="btn btn-primary" disabled={pending}>{pending ? 'Mengirim...' : 'Kirim komplain'}</button>
    </form>
  );
}
