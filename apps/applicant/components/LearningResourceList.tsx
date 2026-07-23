import { SafeMarkdown } from "./SafeMarkdown";

// Shape shared by listTasksByWeek / listVideoResources rows — the fields needed to render a resource.
export type LearningResourceItem = {
  id: string;
  type: "MARKDOWN" | "YOUTUBE" | "DOCUMENT";
  title: string;
  description: string | null;
  url: string | null;
  markdownContent: string | null;
  fileId: string | null;
  file?: { originalName: string } | null;
};

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

function typeLabel(type: LearningResourceItem["type"]): string {
  return type === "MARKDOWN" ? "Reading" : type === "DOCUMENT" ? "Document" : "Video";
}

function ResourceItemCard({ resource }: { resource: LearningResourceItem }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-500">{typeLabel(resource.type)}</p>
      <h4 className="mt-1 font-semibold text-slate-900">{resource.title}</h4>
      {resource.description ? <p className="mt-1 text-sm text-slate-600">{resource.description}</p> : null}
      {resource.type === "MARKDOWN" && resource.markdownContent ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-brand-blue">Open learning resource</summary>
          <div className="mt-3">
            <SafeMarkdown markdown={resource.markdownContent} />
          </div>
        </details>
      ) : resource.type === "YOUTUBE" && isSafeYouTubeUrl(resource.url) ? (
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex text-sm font-semibold text-brand-blue underline"
        >
          Open YouTube video
        </a>
      ) : resource.type === "DOCUMENT" && resource.fileId ? (
        <a
          href={`/api/files/${resource.fileId}/download`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex text-sm font-semibold text-brand-blue underline"
        >
          📄 Download {resource.file?.originalName ?? "document"}
        </a>
      ) : (
        <p className="mt-3 text-sm font-medium text-amber-700">Resource pending.</p>
      )}
    </div>
  );
}

/** Renders a task's learning resources (reading / video / document) — shared by the Tasks page and
 * the Mission Workspace so both stay in sync. */
export function LearningResourceList({ resources }: { resources: LearningResourceItem[] }) {
  if (resources.length === 0) {
    return <p className="text-sm font-medium text-amber-700">Learning resources have not been attached yet.</p>;
  }
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {resources.map((resource) => (
        <ResourceItemCard key={resource.id} resource={resource} />
      ))}
    </div>
  );
}
