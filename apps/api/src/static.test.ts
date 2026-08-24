import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createServer, request, type IncomingHttpHeaders } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import assert from "node:assert/strict";
import { test } from "node:test";
import { gzipBuffer } from "./compress.ts";
import { staticCacheControl, tryServeStatic } from "./static.ts";

test("hashed assets and fonts are cached; html is not", () => {
  assert.equal(staticCacheControl("/assets/index-abc.js", "/tmp/index-abc.js"), "public, max-age=31536000, immutable");
  assert.equal(
    staticCacheControl("/fonts/meem/MeemFaNum-Regular.woff2", "/tmp/MeemFaNum-Regular.woff2"),
    "public, max-age=31536000, immutable",
  );
  assert.equal(staticCacheControl("/", "/tmp/index.html"), "no-cache");
});

test("gzipBuffer skips tiny payloads and missing accept-encoding", () => {
  const req = { headers: { "accept-encoding": "gzip" } } as never;
  assert.equal(gzipBuffer(Buffer.from("short"), req), null);
  const large = Buffer.from("x".repeat(800));
  assert.equal(gzipBuffer(large, { headers: {} } as never), null);
  const zipped = gzipBuffer(large, req);
  assert.ok(zipped);
  assert.equal(gunzipSync(zipped.body).toString(), large.toString());
});

function getRaw(url: string): Promise<{ status: number; headers: IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    request(url, { headers: { "Accept-Encoding": "gzip" } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk as Buffer));
      res.on("end", () =>
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }),
      );
    })
      .on("error", reject)
      .end();
  });
}

test("static js is gzipped and cacheable", async () => {
  const dir = mkdtempSync(join(tmpdir(), "price-update-static-"));
  const assets = join(dir, "assets");
  mkdirSync(assets);
  const js = `console.log(${JSON.stringify("x".repeat(800))});`;
  writeFileSync(join(assets, "app.js"), js);

  const server = createServer((req, res) => {
    if (!tryServeStatic(dir, req, res, {})) res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const response = await getRaw(`http://127.0.0.1:${address.port}/assets/app.js`);
    assert.equal(response.status, 200);
    assert.equal(response.headers["content-encoding"], "gzip");
    assert.match(String(response.headers["cache-control"] ?? ""), /immutable/);
    assert.equal(gunzipSync(response.body).toString(), js);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
