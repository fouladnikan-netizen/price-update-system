import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { gzipBuffer, mergeVary } from "./compress.ts";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
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

const COMPRESSIBLE = new Set([".html", ".js", ".mjs", ".css", ".json", ".svg", ".txt", ".xml"]);

function safeFile(root: string, pathname: string): string | null {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolved = resolve(root, relative);
  const rootResolved = resolve(root);
  if (resolved !== rootResolved && !resolved.startsWith(rootResolved + sep)) return null;
  return resolved;
}

export function staticCacheControl(pathname: string, servedPath: string): string {
  const ext = extname(servedPath).toLowerCase();
  if (pathname.startsWith("/assets/") || ext === ".woff2") {
    return "public, max-age=31536000, immutable";
  }
  if (ext === ".html" || pathname === "/") return "no-cache";
  return "public, max-age=3600";
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
  let pathname = url.pathname;
  if (!existsSync(file) || statSync(file).isDirectory()) {
    file = join(root, "index.html");
    pathname = "/";
  }
  if (!existsSync(file) || statSync(file).isDirectory()) return false;
  const ext = extname(file).toLowerCase();
  const type = MIME[ext] ?? "application/octet-stream";
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Cache-Control": staticCacheControl(pathname, file),
    ...extraHeaders,
  };
  if (req.method === "HEAD") {
    res.writeHead(200, headers);
    res.end();
    return true;
  }
  if (COMPRESSIBLE.has(ext)) {
    const raw = readFileSync(file);
    const compressed = gzipBuffer(raw, req);
    if (compressed) {
      headers["Content-Encoding"] = compressed.encoding;
      headers["Content-Length"] = String(compressed.body.length);
      headers.Vary = mergeVary(headers.Vary, "Accept-Encoding");
      res.writeHead(200, headers);
      res.end(compressed.body);
      return true;
    }
    headers["Content-Length"] = String(raw.length);
    res.writeHead(200, headers);
    res.end(raw);
    return true;
  }
  headers["Content-Length"] = String(statSync(file).size);
  res.writeHead(200, headers);
  createReadStream(file).pipe(res);
  return true;
}

export function staticDirExists(dir: string | null): dir is string {
  return Boolean(dir && existsSync(dir) && statSync(dir).isDirectory());
}
