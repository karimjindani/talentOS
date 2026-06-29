import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalHeader } from "@/components/PortalHeader";
import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import {
  createSubmittedApplication,
  findActiveApplication,
  getTenantBySlug,
  listPublishedPrograms,
  provisionApplicantUser
} from "@talentos/db";

const MOTIVATION_LABEL = "Why do you want to join?";

async function submitApplication(formData: FormData) {
  "use server";

  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    redirect("/login?callbackUrl=/apply");
  }

  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) {
    throw new Error(`Unknown tenant "${tenantSlug}".`);
  }

  const programId = String(formData.get("programId") ?? "");
  const motivation = String(formData.get("motivation") ?? "").trim();
  if (!motivation) {
    throw new Error("A motivation is required to submit an application.");
  }

  // Only allow applying to a published program owned by the resolved tenant.
  const programs = await listPublishedPrograms(tenant.id);
  const program = programs.find((p) => p.id === programId);
  if (!program) {
    throw new Error("Select a valid program to apply to.");
  }

  const applicant = await provisionApplicantUser({
    email,
    name: session?.user?.name ?? null,
    keycloakSubjectId: session?.user?.keycloakSubjectId ?? null,
    tenantId: tenant.id
  });

  const existing = await findActiveApplication(applicant.id, program.id);
  if (!existing) {
    await createSubmittedApplication({
      tenantId: tenant.id,
      programId: program.id,
      applicantId: applicant.id,
      answers: [{ questionKey: "motivation", questionLabel: MOTIVATION_LABEL, answer: motivation }]
    });
  }

  redirect("/application");
}

export default async function ApplyPage() {
  const session = await auth();
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  const programs = tenant ? await listPublishedPrograms(tenant.id) : [];

  return (
    <main>
      <PortalHeader tenantSlug={tenantSlug} />
      <section className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-3xl font-bold">Apply to the TalentOS pilot</h1>
        <p className="mt-3 text-slate-600">
          Submit your application to a published program. You can track its status from your
          application page once submitted.
        </p>

        {!tenant ? (
          <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
            This workspace ({tenantSlug}) is not configured for applications yet.
          </p>
        ) : programs.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
            There are no published programs accepting applications right now.
          </p>
        ) : (
          <form action={submitApplication} className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-1">
              <span className="text-sm font-medium">Applicant</span>
              <p className="text-slate-700">
                {session?.user?.name ? `${session.user.name} · ` : ""}
                {session?.user?.email}
              </p>
            </div>
            <label className="block">
              <span className="text-sm font-medium">Program</span>
              <select
                name="programId"
                defaultValue={programs[0]?.id}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium">{MOTIVATION_LABEL}</span>
              <textarea
                className="mt-1 min-h-32 w-full rounded-lg border border-slate-300 px-3 py-2"
                name="motivation"
                required
                placeholder="Tell us why you want to join this program."
              />
            </label>
            <button className="rounded-xl bg-brand-blue px-5 py-3 font-semibold text-white" type="submit">
              Submit application
            </button>
          </form>
        )}

        <p className="mt-6 text-sm text-slate-500">
          Already applied? <Link className="text-brand-blue" href="/application">View your application</Link>.
        </p>
      </section>
    </main>
  );
}
