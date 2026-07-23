"use client";

import { useEffect, useRef, useState } from "react";

type YTPlayer = {
  destroy?: () => void;
  getCurrentTime?: () => number;
  getDuration?: () => number;
};
type YTPlayerState = { data: number };
type YTNamespace = {
  Player: new (elementId: string, options: Record<string, unknown>) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number };
};
// Accessed via a local cast rather than a global `Window` augmentation, to avoid colliding with the
// (differently-typed) augmentation in YouTubeTutorialPlayer.
type YTWindow = { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void };

const YT_API_SRC = "https://www.youtube.com/iframe_api";

/** Embeds a YouTube video and reports watch progress, firing onWatched() once the viewer has watched
 * at least `threshold` (default 90%) of the runtime. Shows a live "% watched" bar. */
export function YouTubeProgressPlayer({
  videoId,
  watched,
  onWatched,
  threshold = 0.9
}: {
  videoId: string;
  watched: boolean;
  onWatched: () => void;
  threshold?: number;
}) {
  const elementId = `yt-progress-${videoId}`;
  const onWatchedRef = useRef(onWatched);
  onWatchedRef.current = onWatched;
  const firedRef = useRef(watched);
  const [percent, setPercent] = useState(watched ? 100 : 0);

  useEffect(() => {
    const ytWindow = window as unknown as YTWindow;
    let player: YTPlayer | undefined;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    function checkProgress() {
      if (!player?.getCurrentTime || !player.getDuration) return;
      const duration = player.getDuration();
      const current = player.getCurrentTime();
      if (!duration || duration <= 0) return;
      const ratio = Math.min(1, current / duration);
      setPercent((prev) => Math.max(prev, Math.round(ratio * 100)));
      if (!firedRef.current && ratio >= threshold) {
        firedRef.current = true;
        setPercent(100);
        onWatchedRef.current();
      }
    }

    function createPlayer() {
      if (cancelled || !ytWindow.YT) return;
      player = new ytWindow.YT.Player(elementId, {
        videoId,
        events: {
          onStateChange: (event: YTPlayerState) => {
            const playing = ytWindow.YT && event.data === ytWindow.YT.PlayerState.PLAYING;
            if (playing) {
              if (!interval) interval = setInterval(checkProgress, 1000);
            } else {
              if (interval) {
                clearInterval(interval);
                interval = undefined;
              }
              checkProgress();
            }
          }
        }
      });
    }

    if (ytWindow.YT?.Player) {
      createPlayer();
    } else {
      if (!document.querySelector(`script[src="${YT_API_SRC}"]`)) {
        const script = document.createElement("script");
        script.src = YT_API_SRC;
        document.body.appendChild(script);
      }
      const previous = ytWindow.onYouTubeIframeAPIReady;
      ytWindow.onYouTubeIframeAPIReady = () => {
        previous?.();
        createPlayer();
      };
    }

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      player?.destroy?.();
    };
  }, [elementId, videoId, threshold]);

  const done = percent >= threshold * 100;

  return (
    <div>
      <div id={elementId} className="aspect-video w-full overflow-hidden rounded-xl bg-black" />
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-all ${done ? "bg-emerald-500" : "bg-brand-blue"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${done ? "text-emerald-700" : "text-slate-500"}`}>
          {done ? "Watched ✓" : `${percent}% watched`}
        </span>
      </div>
    </div>
  );
}
