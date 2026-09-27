import { hoursAction } from '@/app/actions';
import { requireActor } from '@/lib/guard';
import { listHours } from '@/lib/repo';

const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export default async function SchedulePage() {
  const actor = await requireActor('provider');
  const hours = await listHours(actor);
  return (
    <form action={hoursAction} className="grid max-w-xl gap-3">
      <h1 className="text-3xl">Jadwal</h1>
      {days.map((label, weekday) => {
        const row = hours.find((item) => Number(item.weekday) === weekday);
        return (
          <div key={label} className="card grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 p-3 text-sm">
            <span className="font-bold">{label}</span>
            <input className="input" name={`start-${weekday}`} defaultValue={String(row?.start_time || '08:00').slice(0, 5)} />
            <input className="input" name={`end-${weekday}`} defaultValue={String(row?.end_time || '17:00').slice(0, 5)} />
            <label className="flex items-center gap-1"><input type="checkbox" name={`active-${weekday}`} defaultChecked={row ? row.is_active !== false : true} /> Buka</label>
          </div>
        );
      })}
      <button className="btn btn-primary">Simpan jadwal</button>
    </form>
  );
}
