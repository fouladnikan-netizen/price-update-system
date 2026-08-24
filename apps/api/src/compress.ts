import { gzipSync } from "node:zlib";
import type { IncomingMessage } from "node:http";

const MIN_BYTES = 512;

export function acceptedContentEncoding(req: IncomingMessage): "gzip" | null {
  const accept = String(req.headers["accept-encoding"] ?? "");
  return /\bgzip\b/.test(accept) ? "gzip" : null;
}

export function mergeVary(existing: string | undefined, value: string): string {
  const parts = new Set(
    `${existing ?? ""},${value}`
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  return [...parts].join(", ");
}

export function gzipBuffer(bytes: Buffer, req: IncomingMessage): { body: Buffer; encoding: "gzip" } | null {
  if (bytes.length < MIN_BYTES) return null;
  if (acceptedContentEncoding(req) !== "gzip") return null;
  return { body: gzipSync(bytes), encoding: "gzip" };
}
