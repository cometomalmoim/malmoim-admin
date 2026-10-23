import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, mocks = {}, globals = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const loaded = { exports: {} };
  runInNewContext(outputText, { module: loaded, exports: loaded.exports, Blob, File, Uint8Array, DataView, setTimeout, clearTimeout,
    require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), ...globals });
  return loaded.exports;
}
const types = load("./review-types.ts");
const format = load("./review-photo-format.ts");
const jpeg = new Uint8Array([255, 216, 255, 224, 0, 4, 0, 0, 0, 0, 255, 217]);
const png = new Uint8Array(33);
png.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);
const webp = new Uint8Array(24);
webp.set([82,73,70,70,16,0,0,0,87,69,66,80,86,80,56,32,4,0,0,0]);
const blobs = { "image/jpeg": jpeg, "image/png": png, "image/webp": webp };

test("MIME must match a nontruncated JPEG / PNG / WebP container header", () => {
  for (const [mime, bytes] of Object.entries(blobs)) {
    assert.ok(format.reviewPhotoExtension(bytes, mime));
    assert.equal(format.reviewPhotoExtension(bytes, "text/plain"), null);
    assert.equal(format.reviewPhotoExtension(bytes.subarray(0, 8), mime), null);
  }
  assert.equal(format.reviewPhotoExtension(png, "image/jpeg"), null);
  const wrongLength = new Uint8Array(webp); wrongLength[4] = 100;
  assert.equal(format.reviewPhotoExtension(wrongLength, "image/webp"), null);
  const wrongChunk = new Uint8Array(png); wrongChunk[12] = 0;
  assert.equal(format.reviewPhotoExtension(wrongChunk, "image/png"), null);
});

function browser({ encode, transparent = false, bitmapFails = false } = {}) {
  const calls = []; let closed = 0; const revoked = [];
  const canvas = { width: 0, height: 0,
    getContext: () => ({ drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, transparent ? 0 : 255]) }) }),
    toBlob(callback, mime, quality) {
      calls.push({ mime, quality, width: this.width, height: this.height });
      callback(encode ? encode(mime, quality) : new Blob([blobs[mime]], { type: mime }));
    },
  };
  class ImageElement {
    naturalWidth = 4032; naturalHeight = 3024;
    set src(value) { if (value) queueMicrotask(() => this.onload()); }
  }
  const api = load("./review-photo-client.ts", { "./review-types": types, "./review-photo-format": format }, {
    document: { createElement: () => canvas }, Image: ImageElement,
    URL: { createObjectURL: () => "blob:local-test", revokeObjectURL: url => revoked.push(url) },
    createImageBitmap: async () => { if (bitmapFails) throw new Error("decoder unsupported"); return { width: 4032, height: 3024, close: () => closed++ }; },
  });
  return { ...api, calls, canvas, closed: () => closed, revoked };
}
const original = (size = 1024, mime = "image/jpeg") => new File([new Uint8Array(size)], "original.jpg", { type: mime, lastModified: 123 });

test("a 5MiB original is re-encoded at 1600px without returning original bytes", async () => {
  const api = browser();
  const input = original(types.ORIGINAL_PHOTO_LIMIT);
  const result = await api.prepareReviewPhoto(input);
  assert.equal(result.type, "image/webp"); assert.ok(result.size <= types.PHOTO_LIMIT);
  assert.notEqual(result, input); assert.equal(result.name, "original.webp");
  assert.equal(api.calls[0].width, 1600); assert.equal(api.calls[0].height, 1200);
  assert.equal(api.closed(), 1); assert.equal(api.canvas.width, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(api.reviewPhotoSize(800, 600))), { width: 800, height: 600 });
});
test("oversized, empty and unsupported originals fail before decoding", async () => {
  const api = browser();
  await assert.rejects(api.prepareReviewPhoto(original(types.ORIGINAL_PHOTO_LIMIT + 1)), /5MB/);
  await assert.rejects(api.prepareReviewPhoto(original(0)), /빈 파일/);
  await assert.rejects(api.prepareReviewPhoto(original(100, "image/heic")), /JPG/);
  assert.equal(api.calls.length, 0);
});
for (const transparent of [true, false]) {
  test(`unsupported WebP encoder falls back to ${transparent ? "transparent PNG" : "JPEG"}`, async () => {
    const api = browser({ transparent, bitmapFails: true, encode: mime => new Blob([blobs[mime === "image/webp" ? "image/png" : mime]], { type: mime === "image/webp" ? "image/png" : mime }) });
    const result = await api.prepareReviewPhoto(original());
    assert.equal(result.type, transparent ? "image/png" : "image/jpeg");
    assert.deepEqual(api.revoked, ["blob:local-test"]);
  });
}
test("quality / size retries are bounded and never pass an oversized result", async () => {
  const api = browser({ encode: mime => new Blob([new Uint8Array(types.PHOTO_LIMIT + 1)], { type: mime }) });
  await assert.rejects(api.prepareReviewPhoto(original()), /화질/);
  assert.equal(api.calls.length, 9);
  assert.ok(api.calls.every(call => call.quality >= 0.74));
  assert.equal(api.calls.at(-1).width, 1280); assert.equal(api.closed(), 1);
});

function actions({ previous = [], uploadError = false } = {}) {
  const writes = []; let table = "";
  const query = {
    select() { return this; }, eq() { return this; },
    single: async () => ({ data: { photo_paths: previous }, error: null }),
    insert(values) { writes.push({ insert: values }); return { select: () => ({ single: async () => ({ data: { id: values.id }, error: null }) }) }; },
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } }, error: null }) },
    from: value => { table = value; return query; },
    storage: { from: () => ({ upload: async (path, file) => { writes.push({ upload: path, size: file.size }); return { error: uploadError ? new Error("PRIVATE_STORAGE_ERROR") : null }; }, remove: async paths => { writes.push({ remove: paths }); return { error: null }; } }) },
  };
  return { ...load("./review-actions.ts", {
    "next/cache": { revalidatePath() {} }, "@/lib/supabase/server": { createClient: async () => client },
    "./review-permission": { checkReviewApproval: async () => "approved" },
    "./review-store": { REVIEW_BUCKET: "history-review-photos" }, "./review-types": types, "./review-photo-format": format,
  }, { crypto: globalThis.crypto }), writes, table: () => table };
}
function form(files = []) {
  const data = new FormData(); data.set("title", "로컬 테스트 제목"); data.set("category", "regular"); data.set("content", "로컬 테스트 본문");
  for (const file of files) data.append("photos", file);
  return data;
}
const processed = (size = types.PHOTO_LIMIT) => {
  const bytes = new Uint8Array(size); bytes.set(jpeg.subarray(0, 10)); bytes.set([255, 217], size - 2);
  return new File([bytes], "photo.jpg", { type: "image/jpeg" });
};
test("server accepts exactly 1MiB processed files and stores UUID paths", async () => {
  const api = actions(); const result = await api.saveReview(form([processed()]));
  assert.equal(result.ok, true); assert.equal(api.table(), "history_reviews");
  assert.match(api.writes[0].upload, /^aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\/[0-9a-f-]+\/[0-9a-f-]+\.jpg$/);
  assert.equal(api.writes[0].size, types.PHOTO_LIMIT);
});
for (const [name, files] of [
  ["oversized", [processed(types.PHOTO_LIMIT + 1)]], ["four", Array.from({ length: 4 }, () => processed(100))],
  ["empty", [new File([], "empty.jpg", { type: "image/jpeg" })]],
  ["non-file attachment", ["not-a-file"]],
  ["unsupported MIME", [new File([jpeg], "not-supported.svg", { type: "image/svg+xml" })]],
  ["fake MIME", [new File([png], "fake.jpg", { type: "image/jpeg" })]],
  ["truncated header", [new File([jpeg.subarray(0, 3)], "fake.jpg", { type: "image/jpeg" })]],
]) {
  test(`server rejects ${name} files without upload or DB writes`, async () => {
    const api = actions(); const result = await api.saveReview(form(files));
    assert.equal(result.ok, false); assert.deepEqual(api.writes, []);
  });
}
test("server counts existing attachments and does not report upload failure as success", async () => {
  const api = actions({ previous: ["one", "two", "three"] }); const data = form([processed(100)]);
  data.set("id", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  assert.equal((await api.saveReview(data)).ok, false); assert.deepEqual(api.writes, []);
  const failed = actions({ uploadError: true }); const result = await failed.saveReview(form([processed(100)]));
  assert.equal(result.ok, false); assert.ok(!result.message.includes("PRIVATE_STORAGE_ERROR"));
  assert.ok(!failed.writes.some(write => write.insert));
});

test("SQL bucket and server limit use the same byte value", () => {
  const sql = readFileSync(new URL("../../../../supabase/003_history_reviews.proposed.sql", import.meta.url), "utf8");
  assert.match(sql, new RegExp("false," + types.PHOTO_LIMIT + ",array"));
  assert.equal(types.MAX_PHOTOS, 3);
});
