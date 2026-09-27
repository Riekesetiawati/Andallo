import { bankStatusAction } from '@/app/actions';
import { maskAccount, STATUS_LABEL } from '@/lib/format';
import { requireActor } from '@/lib/guard';
import { listBanks } from '@/lib/repo';

export default async function AdminBanks() {
  const actor = await requireActor('admin');
  const rows = await listBanks(actor, true);
  return (
    <div>
      <h1 className="text-3xl">Verifikasi rekening</h1>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => (
          <article key={row.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-bold">{row.business_name} · {row.bank_name}</p>
              <p className="text-sm">{maskAccount(row.account_number)} · {row.account_holder}</p>
              <span className="badge mt-1">{STATUS_LABEL[row.status]}</span>
            </div>
            <div className="flex gap-2">
              <form action={bankStatusAction}><input type="hidden" name="id" value={row.id} /><input type="hidden" name="status" value="VERIFIED" /><button className="btn btn-primary">Verifikasi</button></form>
              <form action={bankStatusAction}><input type="hidden" name="id" value={row.id} /><input type="hidden" name="status" value="REJECTED" /><button className="btn">Tolak</button></form>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
