export function isLocalhostUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr.startsWith("http") ? urlStr : `https://${urlStr}`);
    const host = parsed.hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local") ||
      host.endsWith(".internal")
    );
  } catch {
    return false;
  }
}

export function resolveIframeTargetUrl(rawUrl: string): string {
  if (!rawUrl || rawUrl === "about:blank") return "about:blank";

  let url = rawUrl.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  // If it's a local development server, load it directly so hot reloading works
  if (isLocalhostUrl(url)) {
    return url;
  }

  // For external websites (e.g. google.com, github.com, etc.), route through
  // our daemon browser reverse proxy to strip X-Frame-Options and frame-ancestors!
  let daemonBase = "http://127.0.0.1:6767";
  if (typeof window !== "undefined" && window.location?.origin) {
    if (window.location.hostname !== "tauri.localhost") {
      daemonBase = window.location.origin;
    }
  }

  return `${daemonBase}/api/browser-proxy?url=${encodeURIComponent(url)}`;
}
