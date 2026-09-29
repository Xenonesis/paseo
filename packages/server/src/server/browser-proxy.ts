import type { Request, RequestHandler, Response } from "express";
import http from "node:http";
import https from "node:https";
import { URL } from "node:url";
import type { Logger } from "pino";

const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export function sanitizeProxyHeaders(
  rawHeaders: http.IncomingHttpHeaders,
): Record<string, string | string[] | undefined> {
  const headers: Record<string, string | string[] | undefined> = { ...rawHeaders };

  // Remove framing restrictions
  delete headers["x-frame-options"];
  delete headers["X-Frame-Options"];
  delete headers["content-security-policy-report-only"];

  if (headers["content-security-policy"]) {
    const csp = String(headers["content-security-policy"]);
    headers["content-security-policy"] = csp
      .replace(/frame-ancestors[^;]+;?\s*/gi, "")
      .trim();
  }

  // Set permissive CORS
  headers["access-control-allow-origin"] = "*";
  headers["access-control-allow-methods"] = "GET, POST, OPTIONS, HEAD";
  headers["access-control-allow-headers"] = "*";

  return headers;
}

export function injectBaseTagIntoHtml(html: string, targetUrl: string): string {
  // Normalize base URL to have trailing slash if path is empty
  const urlObj = new URL(targetUrl);
  const baseHref = urlObj.toString();

  // Strip meta frame-busting tags
  let cleaned = html.replace(/<meta[^>]+http-equiv=["']X-Frame-Options["'][^>]*>/gi, "");

  // Inject <base href="..."> into <head>
  if (/<head[^>]*>/i.test(cleaned)) {
    return cleaned.replace(/(<head[^>]*>)/i, `$1\n<base href="${baseHref}">`);
  }

  // Fallback if no head tag exists
  return `<base href="${baseHref}">\n${cleaned}`;
}

export function createBrowserProxyHandler(logger?: Logger): RequestHandler {
  return (req: Request, res: Response): void => {
    const rawTarget = req.query.url;
    if (!rawTarget || typeof rawTarget !== "string") {
      res.status(400).json({ error: "Missing required 'url' query parameter" });
      return;
    }

    let parsedUrl: URL;
    try {
      const normalized = rawTarget.startsWith("http://") || rawTarget.startsWith("https://")
        ? rawTarget
        : `https://${rawTarget}`;
      parsedUrl = new URL(normalized);
    } catch {
      res.status(400).json({ error: "Invalid URL parameter" });
      return;
    }

    const client = parsedUrl.protocol === "https:" ? https : http;

    const proxyRequest = client.request(
      parsedUrl,
      {
        method: req.method,
        headers: {
          ...req.headers,
          host: parsedUrl.host,
          "user-agent": DESKTOP_USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "accept-encoding": "identity", // Disable gzip/br to allow easy <base> injection
          referer: parsedUrl.origin,
        },
      },
      (upstreamRes) => {
        const statusCode = upstreamRes.statusCode || 200;

        // Handle redirects (301, 302, 303, 307, 308)
        if (statusCode >= 300 && statusCode < 400 && upstreamRes.headers.location) {
          try {
            const redirectTarget = new URL(upstreamRes.headers.location, parsedUrl).toString();
            res.redirect(`/api/browser-proxy?url=${encodeURIComponent(redirectTarget)}`);
            return;
          } catch {
            // If location is invalid, fall through
          }
        }

        const sanitizedHeaders = sanitizeProxyHeaders(upstreamRes.headers);
        const contentType = String(upstreamRes.headers["content-type"] || "");

        if (contentType.includes("text/html")) {
          let bodyChunks: Buffer[] = [];
          upstreamRes.on("data", (chunk: Buffer) => {
            bodyChunks.push(chunk);
          });

          upstreamRes.on("end", () => {
            const rawHtml = Buffer.concat(bodyChunks).toString("utf-8");
            const transformedHtml = injectBaseTagIntoHtml(rawHtml, parsedUrl.toString());

            delete sanitizedHeaders["content-length"];
            sanitizedHeaders["content-type"] = "text/html; charset=utf-8";

            res.writeHead(statusCode, sanitizedHeaders);
            res.end(transformedHtml);
          });
        } else {
          res.writeHead(statusCode, sanitizedHeaders);
          upstreamRes.pipe(res);
        }
      },
    );

    proxyRequest.on("error", (err) => {
      logger?.warn({ err: err.message, url: parsedUrl.toString() }, "Browser proxy upstream connection error");
      res.status(502).json({ error: "Failed to connect to target website", details: err.message });
    });

    if (req.method !== "GET" && req.method !== "HEAD") {
      req.pipe(proxyRequest);
    } else {
      proxyRequest.end();
    }
  };
}
