export default function Loading() {
  return (
    <div className="container grid gap-3 py-10">
      <div className="h-8 w-48 animate-pulse rounded-full bg-white" />
      <div className="grid gap-3 md:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-40 animate-pulse rounded-3xl bg-white" />)}</div>
    </div>
  );
}
