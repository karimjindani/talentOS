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
  const programs = tenant ? await listPublishedPrograms(tenant.id) : [];
  const errorCode = (await searchParams)?.error;
  const errorMessage = errorCode ? APPLY_ERROR_MESSAGES[errorCode] : null;

  return (
    <main>
      <PortalHeader tenantSlug={tenantSlug} />
      <section className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-3xl font-bold">Apply to the TalentOS pilot</h1>
        <p className="mt-3 text-slate-600">
          Submit your application to a published program. You can track its status from your
          application page once submitted.
        </p>

        {errorMessage ? (
          <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
            {errorMessage}
          </p>
        ) : null}

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
            <label className="block">
              <span className="text-sm font-medium">CV (PDF, max 5 MB)</span>
              <input
                type="file"
                name="cv"
                accept="application/pdf"
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">GitHub profile (optional)</span>
              <input
                type="url"
                name="githubUrl"
                inputMode="url"
                placeholder="https://github.com/your-username"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">LinkedIn profile (optional)</span>
              <input
                type="url"
                name="linkedinUrl"
                inputMode="url"
                placeholder="https://www.linkedin.com/in/your-name"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
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
