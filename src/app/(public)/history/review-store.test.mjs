import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, mocks) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const loaded = { exports: {} };
  runInNewContext(outputText, {
    module: loaded, exports: loaded.exports, process: { env: { NODE_ENV: "test" } },
    require: name => name === "@/components/public-translation" ? {Localized:({children})=>children} : Object.hasOwn(mocks, name) ? mocks[name] : require(name),
  });
  return loaded.exports;
}
const plain = value => JSON.parse(JSON.stringify(value));
const row = (id, paths = []) => ({
  id, author_id: "test-author", title: "테스트 후기", content: "보존되어야 하는 후기 본문",
  category: "regular", display_name: "테스트 표시명", photo_paths: paths,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
});
function store(rows, sign, error = null) {
  const requests = [];
  const query = {
    select() { return this; }, order() { return this; },
    range(from, to) { requests.push({ range: [from, to] }); return this; },
    eq(column, value) { requests.push({ filter: [column, value] }); return this; },
    then(resolve, reject) { return Promise.resolve({ data: rows, error }).then(resolve, reject); },
  };
  const client = {
    from(table) { assert.equal(table, "history_reviews"); return query; },
    storage: { from(bucket) {
      assert.equal(bucket, "history-review-photos");
      return { createSignedUrls(paths, expiry) {
        requests.push({ paths, expiry }); return sign(paths);
      } };
    } },
  };
  return {
    ...load("./review-store.ts", { "server-only": {}, "@/lib/supabase/server": { createClient: async () => client } }),
    requests,
  };
}

test("a missing or reordered photo preserves every review and original attachment index", async () => {
  const paths = ["private/first.jpg", "private/missing.jpg", "private/last.jpg"];
  const rows = [row("with-photos", paths), ...Array.from({ length: 6 }, (_, i) => row(`text-${i}`))];
  const api = store(rows, async () => ({ error: null, data: [
    { path: paths[2], signedUrl: "https://example.test/last", error: null },
    { path: paths[1], signedUrl: null, error: "PRIVATE_STORAGE_ERROR" },
    { path: paths[0], signedUrl: "https://example.test/first", error: null },
  ] }));
  const result = plain(await api.readReviews("regular", 6));
  assert.equal(result.error, "");
  assert.equal(result.reviews.length, 6);
  assert.equal(result.more, true);
  assert.equal(result.reviews[0].content, rows[0].content);
  assert.deepEqual(result.reviews[0].photo_paths, paths);
  assert.deepEqual(result.reviews[0].photos, ["https://example.test/first", null, "https://example.test/last"]);
  assert.deepEqual(result.reviews[1].photos, []);
  assert.deepEqual(plain(api.requests), [
    { range: [6, 12] }, { filter: ["category", "regular"] }, { paths, expiry: 3600 },
  ]);
  assert.ok(!JSON.stringify(result).includes("PRIVATE_STORAGE_ERROR"));
});

for (const failure of ["error-result", "exception"]) {
  test(`Storage ${failure} does not block text or other reviews' photos`, async () => {
    const api = store([row("failed", ["private/failed.jpg"]), row("healthy", ["private/healthy.jpg"])], async paths => {
      if (paths[0].includes("failed")) {
        if (failure === "exception") throw new Error("PRIVATE_STORAGE_ERROR");
        return { data: null, error: { message: "PRIVATE_STORAGE_ERROR" } };
      }
      return { data: [{ path: paths[0], signedUrl: "https://example.test/healthy", error: null }], error: null };
    });
    const result = plain(await api.readReviews());
    assert.equal(result.error, "");
    assert.equal(result.reviews.length, 2);
    assert.deepEqual(result.reviews[0].photos, [null]);
    assert.deepEqual(result.reviews[1].photos, ["https://example.test/healthy"]);
    assert.ok(!JSON.stringify(result).includes("PRIVATE_STORAGE_ERROR"));
  });
}

test("a DB failure stays a generic list error rather than an empty success", async () => {
  const api = store(null, () => assert.fail("Storage must not be requested"), { message: "PRIVATE_DB_ERROR" });
  const result = plain(await api.readReviews());
  assert.ok(result.error);
  assert.ok(!result.error.includes("PRIVATE_DB_ERROR"));
  assert.deepEqual(result.reviews, []);
  assert.equal(result.more, false);
});

test("cards, details and editing retain usable photos and controls for a failed first attachment", () => {
  const types = load("./review-types.ts", {});
  const { ReviewCard, ReviewDetail, ReviewEditor } = load("./history-reviews.tsx", {
    "next/image": { default: ({ unoptimized, ...props }) => { void unoptimized; return createElement("img", props); } },
    "next/link": { default: props => createElement("a", props) },
    "./review-actions": {}, "./review-types": types, "./review-photo-client": {},
  });
  const review = { ...row("test-review", ["private/failed.jpg", "private/healthy.jpg"]), photos: [null, "https://example.test/healthy"] };
  const card = renderToStaticMarkup(createElement(ReviewCard, { review, open() {} }));
  assert.match(card, /src="https:\/\/example.test\/healthy"/);
  const detail = renderToStaticMarkup(createElement(ReviewDetail, { review, close() {} }));
  assert.ok(detail.includes(review.content));
  assert.match(detail, /일부 사진을 불러오지 못했어요/);
  assert.match(detail, /첨부 사진 2/);
  const editor = renderToStaticMarkup(createElement(ReviewEditor, { review, close() {}, saved: async () => {} }));
  assert.match(editor, /기존 사진 1 삭제/);
  assert.match(editor, /기존 사진 2 삭제/);
  assert.match(editor, /선택 · 2 \/ 3장/);
  for (const html of [card, detail, editor]) {
    assert.ok(!html.includes('src=""'));
    assert.ok(!html.includes("private/failed.jpg"));
  }
});
