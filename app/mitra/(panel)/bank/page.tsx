import { BankForm } from '@/components/mitra-forms';
import { maskAccount, STATUS_LABEL } from '@/lib/format';
import { requireActor } from '@/lib/guard';
import { listBanks } from '@/lib/repo';

export default async function BankPage() {
  const actor = await requireActor('provider');
  const banks = await listBanks(actor);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h1 className="text-3xl">Rekening</h1>
        <div className="mt-4 grid gap-3">
          {banks.map((bank) => (
            <article key={bank.id} className="card p-4">
              <p className="font-bold">{bank.bank_name}</p>
              <p>{maskAccount(bank.account_number)} · {bank.account_holder}</p>
              <span className="badge mt-2">{STATUS_LABEL[bank.status] || bank.status}</span>
            </article>
          ))}
          {!banks.length ? <p className="text-muted">Belum ada rekening.</p> : null}
        </div>
      </div>
      <BankForm />
    </div>
  );
}
