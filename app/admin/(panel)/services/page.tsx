import { rupiah } from '@/lib/format';
import { adminList } from '@/lib/repo';

export default async function AdminServices() {
  const rows = await adminList('services');
  return (
    <div>
      <h1 className="text-3xl">Jasa mitra</h1>
      <div className="table-wrap mt-4 card">
        <table>
          <thead><tr><th>Jasa</th><th>Mitra</th><th>Kategori</th><th>Harga</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.business_name}</td><td>{row.category_name}</td><td>{rupiah(row.min_price)}</td><td>{row.is_active ? 'Aktif' : 'Nonaktif'}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
