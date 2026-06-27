type ApplicationDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ApplicationDetailPage({ params }: ApplicationDetailPageProps) {
  const { id } = await params;

  return (
    <>
      <h1 className="text-3xl font-bold">Application {id}</h1>
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Review workflow</h2>
        <p className="mt-2 text-slate-600">
          Admin review actions will use explicit application status transitions and write audit log entries.
        </p>
      </section>
    </>
  );
}
