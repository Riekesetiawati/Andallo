import { ProviderRegisterForm } from '@/components/forms';
import { listCategories } from '@/lib/catalog';

export default async function MitraRegisterPage() {
  const categories = await listCategories();
  return (
    <div className="container max-w-3xl py-10">
      <p className="text-sm font-bold text-leaf">Mitra Andallo</p>
      <h1 className="text-4xl">Daftar Menjadi Mitra Andallo</h1>
      <p className="mt-2 max-w-2xl text-muted">Pengajuan masuk sebagai SUBMITTED. Profil usaha baru tampil ke pelanggan setelah admin memverifikasi.</p>
      <div className="mt-6"><ProviderRegisterForm categories={categories.map((item) => ({ id: item.id, name: item.name }))} /></div>
    </div>
  );
}
