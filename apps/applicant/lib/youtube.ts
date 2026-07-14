/** Extracts a YouTube video ID from watch/short/embed/youtu.be URLs, or null if not a YouTube link. */
export function parseYouTubeVideoId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\.|^m\./, "");

  if (host === "youtu.be") {
    return parsed.pathname.slice(1) || null;
  }
  if (host !== "youtube.com") {
    return null;
  }
  if (parsed.pathname === "/watch") {
    return parsed.searchParams.get("v");
  }
  if (parsed.pathname.startsWith("/embed/")) {
    return parsed.pathname.slice("/embed/".length) || null;
  }
  if (parsed.pathname.startsWith("/shorts/")) {
    return parsed.pathname.slice("/shorts/".length) || null;
  }
  return null;
}
