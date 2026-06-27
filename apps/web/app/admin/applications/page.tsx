const sampleApplications = [
  { id: "app_001", name: "Demo Applicant", status: "SUBMITTED", program: "AI-Native Software Engineering" },
  { id: "app_002", name: "Future Engineer", status: "UNDER_REVIEW", program: "AI-Native Software Engineering" }
];

export default function AdminApplicationsPage() {
  return (
    <>
      <h1 className="text-3xl font-bold">Applications</h1>
      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Applicant</th>
              <th className="px-4 py-3">Program</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {sampleApplications.map((application) => (
              <tr className="border-t border-slate-100" key={application.id}>
                <td className="px-4 py-3 font-medium">{application.name}</td>
                <td className="px-4 py-3">{application.program}</td>
                <td className="px-4 py-3">{application.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
