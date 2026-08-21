import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

function safeFile(root: string, pathname: string): string | null {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolved = resolve(root, relative);
  const rootResolved = resolve(root);
  if (resolved !== rootResolved && !resolved.startsWith(rootResolved + sep)) return null;
  return resolved;
}

export function tryServeStatic(
  root: string,
  req: IncomingMessage,
  res: ServerResponse,
  extraHeaders: Record<string, string>,
): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (url.pathname.startsWith("/api/")) return false;
  const wanted = safeFile(root, decodeURIComponent(url.pathname));
  if (!wanted) return false;
  let file = wanted;
  if (!existsSync(file) || statSync(file).isDirectory()) {
    file = join(root, "index.html");
  }
  if (!existsSync(file) || statSync(file).isDirectory()) return false;
  const type = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
  res.writeHead(200, { "Content-Type": type, ...extraHeaders });
  if (req.method === "HEAD") {
    res.end();
    return true;
  }
  createReadStream(file).pipe(res);
  return true;
}

export function staticDirExists(dir: string | null): dir is string {
  return Boolean(dir && existsSync(dir) && statSync(dir).isDirectory());
}