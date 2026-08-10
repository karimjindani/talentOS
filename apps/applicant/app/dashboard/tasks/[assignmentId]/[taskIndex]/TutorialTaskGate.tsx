"use client";

import { useState } from "react";
import { YouTubeTutorialPlayer } from "@/components/YouTubeTutorialPlayer";
import { ToggleTaskComplete } from "./ToggleTaskComplete";
import type { MissionTaskIndex } from "@talentos/db";

/** Task 2's tutorial + completion toggle. When the tutorial is a YouTube video, "Mark as complete"
 * stays disabled until the video has been watched to the end. */
export function TutorialTaskGate({
  videoId,
  tutorialUrl,
  assignmentId,
  taskIndex,
  complete
}: {
  videoId: string;
  tutorialUrl: string | null;
  assignmentId: string;
  taskIndex: MissionTaskIndex;
  complete: boolean;
}) {
  // Already-completed tasks don't need to be re-watched to keep their checked state.
  const [watched, setWatched] = useState(complete);

  return (
    <div className="grid gap-4">
      <YouTubeTutorialPlayer videoId={videoId} onWatched={() => setWatched(true)} />
      {tutorialUrl ? (
        <a href={tutorialUrl} target="_blank" rel="noreferrer noopener" className="text-xs text-brand-blue underline">
          Open on YouTube
        </a>
      ) : null}
      {!watched ? (
        <p className="text-sm text-amber-700">Watch the full video to unlock &quot;Mark as complete&quot;.</p>
      ) : null}
      <ToggleTaskComplete
        assignmentId={assignmentId}
        taskIndex={taskIndex}
        complete={complete}
        disabled={!watched}
        disabledReason="Watch the video above to the end to unlock this."
      />
    </div>
  );
}
