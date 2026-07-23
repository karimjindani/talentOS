"use client";

import { useState } from "react";
import { SafeMarkdown } from "./SafeMarkdown";
import { YouTubeProgressPlayer } from "./YouTubeProgressPlayer";
import { TaskCompletionButton } from "@/app/dashboard/tasks/TaskCompletionButton";
import { parseYouTubeVideoId } from "@/lib/youtube";
import type { LearningResourceItem } from "./LearningResourceList";

function typeLabel(type: LearningResourceItem["type"]): string {
  return type === "MARKDOWN" ? "Reading" : type === "DOCUMENT" ? "Document" : "Video";
}

function videoIdFor(resource: LearningResourceItem): string | null {
  if (resource.type !== "YOUTUBE" || !resource.url) return null;
  return parseYouTubeVideoId(resource.url);
}

/** A learning task's body: resources render inline (YouTube plays in-tab), and "Mark complete" only
 * unlocks once every video in the task has been watched to ≥90%. */
export function LearningTaskPanel({
  resources,
  complete,
  assignmentOpen,
  taskId,
  missionAssignmentId
}: {
  resources: LearningResourceItem[];
  complete: boolean;
  assignmentOpen: boolean;
  taskId: string;
  missionAssignmentId: string;
}) {
  const videoIds = resources
    .map((resource) => ({ id: resource.id, videoId: videoIdFor(resource) }))
    .filter((entry): entry is { id: string; videoId: string } => entry.videoId !== null);

  const [watched, setWatched] = useState<Set<string>>(new Set());
  const markWatched = (resourceId: string) =>
    setWatched((prev) => {
      if (prev.has(resourceId)) return prev;
      const next = new Set(prev);
      next.add(resourceId);
      return next;
    });

  const allVideosWatched = videoIds.every((entry) => watched.has(entry.id));
  const hasVideos = videoIds.length > 0;

  return (
    <div className="grid gap-5">
      {resources.length === 0 ? (
        <p className="text-sm font-medium text-amber-700">Learning resources have not been attached yet.</p>
      ) : (
        <div className="grid gap-5">
          {resources.map((resource) => {
            const videoId = videoIdFor(resource);
            return (
              <div key={resource.id}>
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
                ) : resource.type === "DOCUMENT" && resource.fileId ? (
                  <a
                    href={`/api/files/${resource.fileId}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex text-sm font-semibold text-brand-blue underline"
                  >
                    📄 Download {resource.file?.originalName ?? "document"}
                  </a>
                ) : resource.type === "YOUTUBE" && videoId ? (
                  <div className="mt-3">
                    <YouTubeProgressPlayer
                      videoId={videoId}
                      watched={complete || watched.has(resource.id)}
                      onWatched={() => markWatched(resource.id)}
                    />
                  </div>
                ) : (
                  <p className="mt-3 text-sm font-medium text-amber-700">Resource pending.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {complete ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          ✓ Task completed.
        </p>
      ) : assignmentOpen ? (
        <div className="border-t border-slate-100 pt-4">
          <TaskCompletionButton
            taskId={taskId}
            missionAssignmentId={missionAssignmentId}
            disabled={hasVideos && !allVideosWatched}
            disabledReason={
              hasVideos && !allVideosWatched ? "Watch the video above to at least 90% to unlock this." : undefined
            }
          />
        </div>
      ) : null}
    </div>
  );
}
