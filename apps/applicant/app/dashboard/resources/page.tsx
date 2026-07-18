import { auth } from "@/auth";
import { SafeMarkdown } from "@/components/SafeMarkdown";
import { getTenantContext } from "@talentos/ui";
import {
  getTenantBySlug,
  getUserByEmail,
  listApplicantApplications,
  listVideoResources
} from "@talentos/db";

export default async function ResourcesPage() {
  const session = await auth();
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  const email = session?.user?.email ?? null;
  const user = email && tenant ? await getUserByEmail(email) : null;
  const applications = user && tenant ? await listApplicantApplications(user.id, tenant.id) : [];
  const acceptedApp = applications.find((application) => application.status === "ACCEPTED");

  if (!user || !tenant || !acceptedApp) {
    return null;
  }

  const resources = await listVideoResources(tenant.id, acceptedApp.program.id);

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-bold text-brand-navy">Learning resources</h1>
      <p className="mt-2 text-slate-600">Markdown guides and videos for your weekly program tasks.</p>

      <div className="mt-6 space-y-8">
        {[1, 2, 3, 4].map((weekNumber) => {
          const weekResources = resources.filter((resource) => resource.weekNumber === weekNumber);
          if (weekResources.length === 0) return null;
          return (
            <section key={weekNumber}>
              <h2 className="border-b border-slate-200 pb-2 text-lg font-semibold text-brand-navy">Week {weekNumber}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {weekResources.map((resource) => (
                  <article key={resource.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      {resource.type === "MARKDOWN" ? "Markdown" : "YouTube"}
                      {resource.task ? ` | ${resource.task.title}` : " | General"}
                    </p>
                    <h3 className="mt-2 font-semibold text-slate-900">{resource.title}</h3>
                    {resource.description ? <p className="mt-1 text-sm text-slate-600">{resource.description}</p> : null}
                    {resource.type === "MARKDOWN" && resource.markdownContent ? (
                      <details className="mt-4">
                        <summary className="cursor-pointer text-sm font-semibold text-brand-blue">Read resource</summary>
                        <div className="mt-3"><SafeMarkdown markdown={resource.markdownContent} /></div>
                      </details>
                    ) : resource.type === "YOUTUBE" && isSafeYouTubeUrl(resource.url) ? (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex text-sm font-semibold text-brand-blue underline"
                      >
                        Open YouTube video
                      </a>
                    ) : (
                      <p className="mt-4 text-sm font-medium text-amber-700">Video URL pending.</p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          );
        })}

        {resources.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
            No learning resources are available yet.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function isSafeYouTubeUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && (host === "youtube.com" || host === "www.youtube.com" || host === "youtu.be");
  } catch {
    return false;
  }
}
