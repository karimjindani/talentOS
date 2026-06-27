type StatusCardProps = {
  title: string;
  description: string;
};

export function StatusCard({ title, description }: StatusCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </section>
  );
}
