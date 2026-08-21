import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
export const RAW_DIR = resolve(REPO_ROOT, "data/raw-inputs");

const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export type RawImageMeta = {
  id: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  storedName: string;
  createdAt: string;
};

export function extensionForMime(mimeType: string): string | null {
  return ALLOWED_MIME[mimeType] ?? null;
}

export function isAllowedImageMime(mimeType: string): boolean {
  return mimeType in ALLOWED_MIME;
}

export function saveRawImage(input: {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}): RawImageMeta {
  if (!isAllowedImageMime(input.mimeType)) {
    throw new Error("فقط تصویر JPEG، PNG، WebP یا GIF پذیرفته می‌شود.");
  }
  if (input.bytes.length === 0) {
    throw new Error("فایل تصویر خالی است.");
  }
  if (input.bytes.length > MAX_IMAGE_BYTES) {
    throw new Error("حجم تصویر بیشتر از ۸ مگابایت است.");
  }
  mkdirSync(RAW_DIR, { recursive: true });
  const id = randomUUID();
  const ext = extensionForMime(input.mimeType) ?? ".bin";
  const storedName = `${id}${ext}`;
  const meta: RawImageMeta = {
    id,
    fileName: input.fileName.trim() || `image${ext}`,
    mimeType: input.mimeType,
    byteSize: input.bytes.length,
    storedName,
    createdAt: new Date().toISOString(),
  };
  writeFileSync(resolve(RAW_DIR, storedName), input.bytes);
  writeFileSync(resolve(RAW_DIR, `${id}.json`), JSON.stringify(meta, null, 2));
  return meta;
}

export function readRawImage(id: string): { meta: RawImageMeta; bytes: Buffer } | null {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const meta = JSON.parse(readFileSync(resolve(RAW_DIR, `${id}.json`), "utf8")) as RawImageMeta;
    if (!meta.mimeType || !meta.storedName || meta.storedName.endsWith(".txt")) return null;
    const bytes = readFileSync(resolve(RAW_DIR, meta.storedName));
    return { meta, bytes };
  } catch {
    return null;
  }
}

export function publicRawUrl(id: string): string {
  return `/api/raw/${id}`;
}

export type RawTextMeta = {
  id: string;
  fileName: string;
  sourceUrl: string;
  byteSize: number;
  storedName: string;
  createdAt: string;
};

export function saveRawText(input: { fileName: string; sourceUrl: string; text: string }): RawTextMeta {
  const text = input.text.trim();
  if (!text) throw new Error("متن خام خالی است.");
  mkdirSync(RAW_DIR, { recursive: true });
  const id = randomUUID();
  const storedName = `${id}.txt`;
  const meta: RawTextMeta = {
    id,
    fileName: input.fileName.trim() || "collect.txt",
    sourceUrl: input.sourceUrl,
    byteSize: Buffer.byteLength(text),
    storedName,
    createdAt: new Date().toISOString(),
  };
  writeFileSync(resolve(RAW_DIR, storedName), text);
  writeFileSync(resolve(RAW_DIR, `${id}.json`), JSON.stringify(meta, null, 2));
  return meta;
}

export function readRawText(id: string): { meta: RawTextMeta; bytes: Buffer } | null {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const meta = JSON.parse(readFileSync(resolve(RAW_DIR, `${id}.json`), "utf8")) as RawTextMeta;
    if (!meta.storedName?.endsWith(".txt")) return null;
    const bytes = readFileSync(resolve(RAW_DIR, meta.storedName));
    return { meta, bytes };
  } catch {
    return null;
  }
}

export function listRawTexts(limit = 20): RawTextMeta[] {
  mkdirSync(RAW_DIR, { recursive: true });
  const names = readdirSync(RAW_DIR).filter((name) => name.endsWith(".json"));
  const rows: RawTextMeta[] = [];
  for (const name of names) {
    try {
      const meta = JSON.parse(readFileSync(resolve(RAW_DIR, name), "utf8")) as RawTextMeta;
      if (meta.storedName?.endsWith(".txt") && meta.id) rows.push(meta);
    } catch {
      // skip broken meta
    }
  }
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, limit);
}
