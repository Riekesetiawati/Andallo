import { adminList } from '@/lib/repo';

export default async function AuditPage() {
  const rows = await adminList('audit');
  return (
    <div>
      <h1 className="text-3xl">Audit</h1>
      <div className="table-wrap mt-4 card">
        <table>
          <thead><tr><th>Waktu</th><th>Admin</th><th>Aksi</th><th>Entitas</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}><td>{new Date(row.created_at).toLocaleString('id-ID')}</td><td>{row.full_name || '—'}</td><td>{row.action}</td><td>{row.entity_type}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
