import { auth } from "@/auth";
import { getTenantContext, StatusBadge } from "@talentos/ui";
import {
  getTenantBySlug,
  getUserByEmail,
  listApplicantApplications,
} from "@talentos/db";
import { LanguagePreferenceForm } from "./LanguagePreferenceForm";

function formatDate(value: Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default async function ProfilePage() {
  const session = await auth();
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  const email = session?.user?.email ?? null;
  const user = email && tenant ? await getUserByEmail(email) : null;
  const applications = user && tenant ? await listApplicantApplications(user.id, tenant.id) : [];
  const acceptedApp = applications.find((a) => a.status === "ACCEPTED");

  if (!user || !tenant || !acceptedApp) {
    return null;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-brand-navy">Profile</h1>
      <p className="mt-2 text-slate-600">Your account information and application details.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Account info */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-navy">Account Information</h2>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-sm font-medium text-slate-500">Name</dt>
              <dd className="mt-0.5 font-medium text-slate-800">{user.name ?? "Not set"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">Email</dt>
              <dd className="mt-0.5 font-medium text-slate-800">{user.email}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">Member since</dt>
              <dd className="mt-0.5 font-medium text-slate-800">{formatDate(user.createdAt)}</dd>
            </div>
          </dl>
        </div>

        {/* Journal preferences */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-navy">Journal Preferences</h2>
          <p className="mt-1 text-sm text-slate-600">
            Choose the language you prefer for Engineering Journal entries. TalentOS does not require English.
          </p>
          <LanguagePreferenceForm defaultLanguage={user.preferredJournalLanguage} />
        </div>

        {/* Application info */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-navy">Application</h2>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-sm font-medium text-slate-500">Program</dt>
              <dd className="mt-0.5 font-medium text-slate-800">{acceptedApp.program.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">Status</dt>
              <dd className="mt-1">
                <StatusBadge status={acceptedApp.status} />
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">Submitted</dt>
              <dd className="mt-0.5 font-medium text-slate-800">{formatDate(acceptedApp.submittedAt)}</dd>
            </div>
            {acceptedApp.githubUrl ? (
              <div>
                <dt className="text-sm font-medium text-slate-500">GitHub</dt>
                <dd className="mt-0.5">
                  <a href={acceptedApp.githubUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand-blue hover:underline">
                    {acceptedApp.githubUrl}
                  </a>
                </dd>
              </div>
            ) : null}
            {acceptedApp.linkedinUrl ? (
              <div>
                <dt className="text-sm font-medium text-slate-500">LinkedIn</dt>
                <dd className="mt-0.5">
                  <a href={acceptedApp.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand-blue hover:underline">
                    {acceptedApp.linkedinUrl}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
    </div>
  );
}
