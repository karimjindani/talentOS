"use client";

import { useEffect, useRef } from "react";

type YTPlayerState = { data: number };
type YTPlayer = { destroy?: () => void };
type YTNamespace = {
  Player: new (elementId: string, options: Record<string, unknown>) => YTPlayer;
  PlayerState: { ENDED: number };
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const YT_API_SRC = "https://www.youtube.com/iframe_api";

/** Embeds a YouTube video via the IFrame Player API and calls onWatched() once it plays to the end. */
export function YouTubeTutorialPlayer({ videoId, onWatched }: { videoId: string; onWatched: () => void }) {
  const elementId = `yt-player-${videoId}`;
  const onWatchedRef = useRef(onWatched);
  onWatchedRef.current = onWatched;

  useEffect(() => {
    let player: YTPlayer | undefined;
    let cancelled = false;

    function createPlayer() {
      if (cancelled || !window.YT) return;
      player = new window.YT.Player(elementId, {
        videoId,
        events: {
          onStateChange: (event: YTPlayerState) => {
            if (window.YT && event.data === window.YT.PlayerState.ENDED) {
              onWatchedRef.current();
            }
          }
        }
      });
    }

    if (window.YT?.Player) {
      createPlayer();
    } else {
      if (!document.querySelector(`script[src="${YT_API_SRC}"]`)) {
        const script = document.createElement("script");
        script.src = YT_API_SRC;
        document.body.appendChild(script);
      }
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        createPlayer();
      };
    }

    return () => {
      cancelled = true;
      player?.destroy?.();
    };
  }, [elementId, videoId]);

  return <div id={elementId} className="aspect-video w-full overflow-hidden rounded-xl bg-black" />;
}
