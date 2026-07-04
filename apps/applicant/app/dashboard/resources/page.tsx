import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import {
  getTenantBySlug,
  getUserByEmail,
  listApplicantApplications,
  listVideoResources,
} from "@talentos/db";

/** Extract YouTube video ID from a URL. */
function getYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export default async function ResourcesPage() {
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

  const program = acceptedApp.program;
  const videos = await listVideoResources(tenant.id, program.id);

  // Group by week
  const weeks = [1, 2, 3, 4];
  const unassigned = videos.filter((v) => v.weekNumber == null);

  return (
    <div>
      <h1 className="text-3xl font-bold text-brand-navy">Resources</h1>
      <p className="mt-2 text-slate-600">Video resources from your HR and tech leads.</p>

      <div className="mt-6 space-y-6">
        {weeks.map((weekNum) => {
          const weekVideos = videos.filter((v) => v.weekNumber === weekNum);
          if (weekVideos.length === 0) return null;
          return (
            <div key={weekNum}>
              <h2 className="mb-3 text-lg font-semibold text-brand-navy">Week {weekNum}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {weekVideos.map((video) => {
                  const ytId = getYouTubeId(video.url);
                  return (
                    <div key={video.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      {ytId ? (
                        <div className="aspect-video w-full bg-slate-900">
                          <iframe
                            className="h-full w-full"
                            src={`https://www.youtube.com/embed/${ytId}`}
                            title={video.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ) : (
                        <div className="flex aspect-video items-center justify-center bg-slate-100">
                          <a
                            href={video.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center gap-2 text-brand-blue hover:underline"
                          >
                            <span className="text-4xl">🎬</span>
                            <span className="text-sm font-medium">Open video</span>
                          </a>
                        </div>
                      )}
                      <div className="p-4">
                        <p className="font-semibold text-slate-800">{video.title}</p>
                        {video.description ? (
                          <p className="mt-1 text-sm text-slate-600">{video.description}</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {unassigned.length > 0 ? (
          <div>
            <h2 className="mb-3 text-lg font-semibold text-brand-navy">General Resources</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {unassigned.map((video) => {
                const ytId = getYouTubeId(video.url);
                return (
                  <div key={video.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {ytId ? (
                      <div className="aspect-video w-full bg-slate-900">
                        <iframe
                          className="h-full w-full"
                          src={`https://www.youtube.com/embed/${ytId}`}
                          title={video.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <div className="flex aspect-video items-center justify-center bg-slate-100">
                        <a
                          href={video.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-col items-center gap-2 text-brand-blue hover:underline"
                        >
                          <span className="text-4xl">🎬</span>
                          <span className="text-sm font-medium">Open video</span>
                        </a>
                      </div>
                    )}
                    <div className="p-4">
                      <p className="font-semibold text-slate-800">{video.title}</p>
                      {video.description ? (
                        <p className="mt-1 text-sm text-slate-600">{video.description}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {videos.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-slate-500">No video resources available yet. Check back soon!</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
