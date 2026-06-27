import { StatusCard } from "@/components/StatusCard";

export default function AdminOverviewPage() {
  return (
    <>
      <h1 className="text-3xl font-bold">Program administration</h1>
      <p className="mt-2 text-slate-600">Owner/admin workspace for applications-first operations.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <StatusCard title="Applications" description="Review submitted applicants and update review status with audit logging." />
        <StatusCard title="Programs" description="Manage tenant-owned programs and publish application entry points." />
        <StatusCard title="Audit" description="Track authentication, status changes and sensitive administrative actions." />
      </div>
    </>
  );
}
