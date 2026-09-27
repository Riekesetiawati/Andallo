import { settingsAction } from '@/app/actions';
import { getSettings } from '@/lib/repo';

export default async function SettingsPage() {
  const rows = await getSettings();
  const booking = rows.find((row) => row.key === 'booking')?.value || {};
  return (
    <form action={settingsAction} className="card max-w-lg grid gap-3 p-5">
      <h1 className="text-3xl">Pengaturan</h1>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="requirePhone" defaultChecked={Boolean(booking.requirePhone)} /> Wajib verifikasi telepon sebelum memesan</label>
      <p className="text-sm text-muted">Batas persetujuan mitra tetap 2 menit. Pembayaran saat ini dicatat sebagai tunai.</p>
      <button className="btn btn-primary">Simpan</button>
    </form>
  );
}
