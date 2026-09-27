import { formatDate } from '@/lib/format';
import { adminList } from '@/lib/repo';

export default async function CustomersPage() {
  const rows = await adminList('customers');
  return (
    <div>
      <h1 className="text-3xl">Pelanggan</h1>
      <div className="table-wrap mt-4 card">
        <table>
          <thead><tr><th>Nama</th><th>Email</th><th>Telepon</th><th>Verifikasi</th><th>Bergabung</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.full_name}</td>
                <td>{row.email}</td>
                <td>{row.phone}</td>
                <td>{row.email_verified_at ? 'Email' : 'Email belum'} · {row.phone_verified_at ? 'Telepon' : 'Telepon belum'}</td>
                <td>{formatDate(row.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
