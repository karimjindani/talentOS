import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalHeader } from "@/components/PortalHeader";
import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import {
  createStoredFile,
  createSubmittedApplication,
  DUPLICATE_APPLICATION_ERROR_MESSAGE,
  findActiveApplication,
  getTenantBySlug,
  listPublishedPrograms,
  markStoredFileReady,
  provisionApplicantUser
} from "@talentos/db";
import { buildObjectKey, getBucket, putObject } from "@talentos/storage";
import { resolveTenantAccess } from "@/lib/tenant-guard";

const MOTIVATION_LABEL = "Why do you want to join?";
const CV_CONTENT_TYPE = "application/pdf";
const CV_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const DUPLICATE_APPLICATION_ERROR_CODE = "duplicate-active-application";
const APPLY_ERROR_MESSAGES: Record<string, string> = {
  [DUPLICATE_APPLICATION_ERROR_CODE]: DUPLICATE_APPLICATION_ERROR_MESSAGE
};

// Allow only the two profile hosts so stored links can't be used for phishing/redirects.
const PROFILE_HOST_SUFFIX: Record<string, string> = {
  github: "github.com",
  linkedin: "linkedin.com"
};

/** Validate an optional profile URL, restricting it to the expected host. Empty → null. */
function parseProfileUrl(raw: string, kind: "github" | "linkedin"): string | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Enter a valid ${kind} URL (including https://).`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Enter a valid ${kind} URL (including https://).`);
  }
  const host = url.hostname.toLowerCase();
  const suffix = PROFILE_HOST_SUFFIX[kind];
  if (host !== suffix && !host.endsWith(`.${suffix}`)) {
    throw new Error(`The ${kind} URL must be a ${suffix} link.`);
  }
  return url.toString();
}

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

  // Validate the CV server-side (the `accept` attribute is only a client-side hint).
  const cv = formData.get("cv");
  if (!(cv instanceof File) || cv.size === 0) {
    throw new Error("A CV (PDF) is required to submit an application.");
  }
  if (cv.type !== CV_CONTENT_TYPE) {
    throw new Error("Your CV must be a PDF file.");
  }
  if (cv.size > CV_MAX_SIZE_BYTES) {
    throw new Error("Your CV must be 5 MB or smaller.");
  }

  const githubUrl = parseProfileUrl(String(formData.get("githubUrl") ?? ""), "github");
  const linkedinUrl = parseProfileUrl(String(formData.get("linkedinUrl") ?? ""), "linkedin");

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

  // Reject duplicates before uploading, so a blocked submission leaves no orphan object.
  const existing = await findActiveApplication(applicant.id, program.id);
  if (existing) {
    redirect(`/apply?error=${DUPLICATE_APPLICATION_ERROR_CODE}`);
  }

  // Stream the CV to object storage, then record it and link it to the new application.
  const storageKey = buildObjectKey({ tenantId: tenant.id, category: "cv", filename: cv.name });
  await putObject({
    key: storageKey,
    body: Buffer.from(await cv.arrayBuffer()),
    contentType: CV_CONTENT_TYPE
  });
  const file = await createStoredFile({
    tenantId: tenant.id,
    ownerUserId: applicant.id,
    bucket: getBucket(),
    storageKey,
    originalName: cv.name,
    contentType: CV_CONTENT_TYPE,
    size: cv.size,
    category: "cv",
    actorUserId: applicant.id
  });
  await markStoredFileReady(file.id, tenant.id);

  try {
    await createSubmittedApplication({
      tenantId: tenant.id,
      programId: program.id,
      applicantId: applicant.id,
      answers: [{ questionKey: "motivation", questionLabel: MOTIVATION_LABEL, answer: motivation }],
      cvFileId: file.id,
      githubUrl,
      linkedinUrl
    });
  } catch (error) {
    if (error instanceof Error && error.message === DUPLICATE_APPLICATION_ERROR_MESSAGE) {
      redirect(`/apply?error=${DUPLICATE_APPLICATION_ERROR_CODE}`);
    }
    throw error;
  }

  redirect("/application");
}

export default async function ApplyPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const session = await auth();
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);

  // The apply page stays open (public recruitment funnel), but a user who is already a member of
  // this tenant has nothing to apply for here — send them to their application status page.
  if (session?.user?.email && tenant) {
    const access = await resolveTenantAccess();
    if (access.ok && !access.isSuperAdmin) {
      redirect("/application");
    }
  }

  const programs = tenant ? await listPublishedPrograms(tenant.id) : [];
  const errorCode = (await searchParams)?.error;
  const errorMessage = errorCode ? APPLY_ERROR_MESSAGES[errorCode] : null;

  const inputClass =
    "w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20";
  const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";

  return (
    <main className="min-h-screen bg-slate-50">
      <PortalHeader tenantSlug={tenantSlug} />
      <section className="mx-auto max-w-3xl px-6 py-10">
        {/* ── Page header banner ── */}
        <div className="rounded-2xl bg-brand-mist p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-blue text-lg text-white">
              📝
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-brand-navy">
                Apply to the TalentOS Pilot
              </h1>
              <p className="mt-1.5 text-sm leading-6 text-slate-600">
                Submit your application to a published program. You can track its status from your
                application page once submitted.
              </p>
            </div>
          </div>
        </div>

        {/* ── Error banner ── */}
        {errorMessage ? (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <span className="text-base leading-none">⚠️</span>
            <p>{errorMessage}</p>
          </div>
        ) : null}

        {/* ── No tenant / no programs ── */}
        {!tenant ? (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <span className="text-base leading-none">⚠️</span>
            <p>
              This workspace ({tenantSlug}) is not configured for applications yet.
            </p>
          </div>
        ) : programs.length === 0 ? (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <span className="text-base leading-none">⚠️</span>
            <p>There are no published programs accepting applications right now.</p>
          </div>
        ) : (
          /* ── Application form ── */
          <form
            action={submitApplication}
            className="mt-6 space-y-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-md"
          >
            {/* Applicant info chip */}
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-sm font-semibold text-brand-blue">
                {(session?.user?.name ?? session?.user?.email ?? "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  {session?.user?.name ?? "Applicant"}
                </p>
                <p className="truncate text-xs text-slate-500">{session?.user?.email}</p>
              </div>
            </div>

            {/* ── Section 1: Program & Motivation ── */}
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold uppercase tracking-wide text-brand-blue">
                  Program &amp; Motivation
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <div>
                <label className={labelClass} htmlFor="programId">
                  Program
                </label>
                <select
                  id="programId"
                  name="programId"
                  defaultValue={programs[0]?.id}
                  className={inputClass}
                >
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass} htmlFor="motivation">
                  {MOTIVATION_LABEL}
                </label>
                <textarea
                  id="motivation"
                  name="motivation"
                  required
                  placeholder="Tell us why you want to join this program…"
                  className={`${inputClass} min-h-32 resize-y`}
                />
              </div>
            </div>

            {/* ── Section 2: Documents ── */}
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold uppercase tracking-wide text-brand-blue">
                  Documents
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <div>
                <label className={labelClass} htmlFor="cv">
                  CV / Resume
                </label>
                <div className="rounded-lg border-2 border-dashed border-slate-300 p-4 transition-colors hover:border-brand-blue">
                  <input
                    id="cv"
                    type="file"
                    name="cv"
                    accept="application/pdf"
                    required
                    className="w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-brand-blue file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-navy"
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">PDF only, 5 MB max.</p>
              </div>
            </div>

            {/* ── Section 3: Profile Links ── */}
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold uppercase tracking-wide text-brand-blue">
                  Profile Links
                </span>
                <span className="text-xs text-slate-400">(optional)</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <div>
                <label className={labelClass} htmlFor="githubUrl">
                  GitHub Profile
                </label>
                <input
                  id="githubUrl"
                  type="url"
                  name="githubUrl"
                  inputMode="url"
                  placeholder="https://github.com/your-username"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="linkedinUrl">
                  LinkedIn Profile
                </label>
                <input
                  id="linkedinUrl"
                  type="url"
                  name="linkedinUrl"
                  inputMode="url"
                  placeholder="https://www.linkedin.com/in/your-name"
                  className={inputClass}
                />
              </div>
            </div>

            {/* ── Submit button ── */}
            <button
              type="submit"
              className="w-full rounded-xl bg-brand-blue px-5 py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
            >
              Submit Application
            </button>
          </form>
        )}

        {/* ── Footer link ── */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-center text-sm text-slate-500">
          Already applied?{" "}
          <Link
            className="font-medium text-brand-blue transition-colors hover:text-brand-navy"
            href="/application"
          >
            View your application →
          </Link>
        </div>
      </section>
    </main>
  );
}
