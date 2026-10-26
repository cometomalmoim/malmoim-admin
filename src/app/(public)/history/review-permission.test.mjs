import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const loaded = { exports: {} };
  runInNewContext(outputText, { module: loaded, exports: loaded.exports, FormData, File, Uint8Array, DataView, crypto: globalThis.crypto,
    process: { env: { NODE_ENV: "test" } }, require: key => key === '@/components/public-translation' ? {Localized:({children})=>children} : Object.hasOwn(mocks, key) ? mocks[key] : require(key) });
  return loaded.exports;
}
const types = load("./review-types.ts");
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const reviewId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function setup({ data = true, rpcError = null, rpcThrows = false, user = { id }, authThrows = false, authError = null } = {}) {
  const calls = [];
  const query = {
    select() { return this; }, eq() { return this; },
    single: async () => ({ data: { id: reviewId, photo_paths: [] }, error: null }),
    insert() { calls.push("insert"); return this; },
    update() { calls.push("update"); return this; },
    delete() { calls.push("delete"); return this; },
  };
  const client = {
    auth: { getUser: async () => { if (authThrows) throw Error("PRIVATE_AUTH"); return { data: { user }, error: authError }; } },
    rpc: async (...args) => { calls.push({ rpc: args }); if (rpcThrows) throw Error("PRIVATE_RPC"); return { data, error: rpcError }; },
    from: () => { calls.push("table"); return query; },
    storage: { from: () => { calls.push("storage"); return { upload: async () => ({ error: null }), remove: async () => ({ error: null }) }; } },
  };
  const permission = load("./review-permission.ts", { "server-only": {}, "./review-diagnostics": { logReviewFailure() {} }, "@/lib/supabase/server": { createClient: async () => client } });
  const actions = load("./review-actions.ts", {
    "next/cache": { revalidatePath() {} }, "@/lib/supabase/server": { createClient: async () => client },
    "./review-permission": permission, "./review-types": types,
    "./review-store": { REVIEW_BUCKET: "history-review-photos" }, "./review-photo-format": load("./review-photo-format.ts"),
  });
  return { ...permission, ...actions, calls };
}
function form(existing = false, photo = false) {
  const data = new FormData(); data.set("title", "테스트"); data.set("category", "regular"); data.set("content", "테스트 본문");
  if (existing) data.set("id", reviewId);
  if (photo) data.append("photos", new File([new Uint8Array([255,216,255,224,0,4,0,0,0,0,255,217])], "test.jpg", { type: "image/jpeg" }));
  return data;
}
for (const [name, options, expected] of [
  ["approved", { data: true }, "approved"], ["revoked/unapproved", { data: false }, "unapproved"],
  ["missing RPC", { rpcError: { code: "PGRST202", message: "PRIVATE_RPC" } }, "error"],
  ["RPC exception", { rpcThrows: true }, "error"], ["invalid RPC response", { data: "true" }, "error"],
  ["null RPC response", { data: null }, "error"],
]) {
  test(`${name}: self access is minimal and fails closed`, async () => {
    const api = setup(options); const access = await api.getReviewAccess();
    assert.deepEqual(JSON.parse(JSON.stringify(access)), { userId: id, permission: expected });
    assert.deepEqual(JSON.parse(JSON.stringify(api.calls)), [{ rpc: ["history_can_create_review"] }]);
  });
}
test("anonymous never queries approval and auth exceptions are isolated", async () => {
  const anon = setup({ user: null }); assert.equal((await anon.getReviewAccess()).permission, "anonymous"); assert.deepEqual(anon.calls, []);
  assert.equal((await setup({ authThrows: true }).getReviewAccess()).permission, "error");
});
for (const options of [{ data: false }, { rpcThrows: true }, { rpcError: { code: "PGRST202" } }, { data: null }]) {
  test(`new save blocks before upload/table writes: ${JSON.stringify(options)}`, async () => {
    const api = setup(options); const result = await api.saveReview(form(false, true));
    assert.equal(result.ok, false); assert.ok([types.reviewApprovalNotice, types.reviewApprovalError].includes(result.message));
    assert.ok(!api.calls.includes("storage") && !api.calls.includes("table"));
  });
}
test("approved new save checks RPC before upload and inserts", async () => {
  const api = setup(); assert.equal((await api.saveReview(form(false, true))).ok, true);
  assert.equal(api.calls[0].rpc[0], "history_can_create_review"); assert.ok(api.calls.includes("storage")); assert.ok(api.calls.includes("insert"));
});
test("revocation after page load is checked again on save", async () => {
  const first = setup(); assert.equal((await first.getReviewAccess()).permission, "approved");
  const later = setup({ data: false }); assert.equal((await later.saveReview(form())).ok, false); assert.ok(!later.calls.includes("insert"));
});
test("missing RPC does not affect existing owner edit with photos or delete", async () => {
  const api = setup({ rpcThrows: true });
  assert.equal((await api.saveReview(form(true, true))).ok, true);
  assert.equal((await api.deleteReview(reviewId)).ok, true);
  assert.ok(api.calls.includes("update") && api.calls.includes("delete"));
  assert.ok(!api.calls.some(call => typeof call === "object" && call.rpc));
});
test("anonymous cannot save even when approval mock says true", async () => {
  const api = setup({ user: null }); assert.equal((await api.saveReview(form())).ok, false); assert.deepEqual(api.calls, []);
});
for (const permission of ["anonymous", "approved", "unapproved", "error"]) {
  test(`screen ${permission} keeps list available and uses the right notice`, () => {
    const ui = load("./history-reviews.tsx", {
      "next/image": { default: props => createElement("img", props) }, "next/link": { default: props => createElement("a", props) },
      "./review-actions": {}, "./review-photo-client": {}, "./review-types": types,
    });
    const html = renderToStaticMarkup(createElement(ui.HistoryReviews, {
      initial: { reviews: [], more: false, error: "" }, userId: permission === "anonymous" ? null : id, permission,
    }));
    assert.ok(html.includes("아직 등록된 참여 후기가 없습니다."));
    assert.equal(html.includes(types.reviewApprovalNotice), false);
    assert.equal(html.includes(types.reviewApprovalError), false);
    assert.ok(html.includes("후기 등록"));
    assert.ok(!html.includes("작성 권한 다시 확인"));
    assert.ok(!html.includes("history_can_create_review") && !html.includes(id));
  });
}

function screen(initialPermission, loadAccess) {
  const hooks = []; let index = 0; const tasks = []; let dirty = false;
  let props = { userId: initialPermission === "anonymous" ? null : id, permission: initialPermission };
  const react = { ...require("react"),
    useState(initial) { const key = index++; if (!(key in hooks)) hooks[key] = initial; return [hooks[key], value => { hooks[key] = typeof value === "function" ? value(hooks[key]) : value; dirty = true; }]; },
    useRef(initial) { const key = index++; return hooks[key] ??= { current: initial }; },
    useTransition() { return [false, action => tasks.push(Promise.resolve(action()))]; },
  };
  const ui = load("./history-reviews.tsx", {
    react, "next/image": { default: () => null }, "next/link": { default: () => null },
    "./review-actions": { loadReviewAccess: loadAccess }, "./review-photo-client": {}, "./review-types": types,
  });
  function render() {
    let node; let passes = 0;
    do { dirty = false; index = 0; node = ui.HistoryReviews({ initial: { reviews: [], more: false, error: "" }, ...props }); assert.ok(++passes < 10); } while (dirty);
    return node;
  }
  function flatten(node) {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(flatten);
    return [node, ...flatten(node.props?.children)];
  }
  return { render, flatten, ui, updateProps(next) { props = next; return flatten(render()); }, async click() {
    const button = flatten(render()).find(node => node.type === "button" && node.props.className === "review-create");
    button.props.onClick(); await Promise.all(tasks); return flatten(render());
  } };
}
for (const [name, response, expected] of [
  ["fresh approved access", { userId: id, permission: "approved" }, true],
  ["unapproved access", { userId: id, permission: "unapproved" }, false],
  ["RPC missing/error", { userId: id, permission: "error" }, false],
  ["revoked since initial render", { userId: id, permission: "unapproved" }, false],
]) {
  test(`new editor click checks current server access: ${name}`, async () => {
    let calls = 0; const view = screen("approved", async () => { calls++; return response; });
    const nodes = await view.click();
    assert.equal(calls, 1);
    assert.equal(nodes.some(node => node.type === view.ui.ReviewEditor), expected);
  });
}
test("anonymous click rechecks server access then shows login dialog", async () => {
  const view = screen("anonymous", async () => ({ userId: null, permission: "anonymous" }));
  const nodes = await view.click();
  assert.ok(nodes.some(node => node.type === view.ui.ReviewDialog && node.props.title === "로그인이 필요합니다"));
  assert.ok(!nodes.some(node => node.type === view.ui.ReviewEditor));
});
test("permission network error blocks form and retry can recover", async () => {
  let calls = 0;
  const view = screen("error", async () => { if (++calls === 1) throw Error("PRIVATE_ERROR"); return { userId: id, permission: "approved" }; });
  assert.ok(!(await view.click()).some(node => node.type === view.ui.ReviewEditor));
  assert.ok((await view.click()).some(node => node.type === view.ui.ReviewEditor));
});

for (const [name, response, expectedNotice] of [
  ["unapproved", { userId: id, permission: "unapproved" }, types.reviewApprovalNotice],
  ["lookup failure", { userId: id, permission: "error" }, types.reviewApprovalError],
  ["network exception", null, types.reviewApprovalError],
]) {
  test(`click presents accessible permission dialog: ${name}`, async () => {
    const view = screen("approved", async () => {
      if (!response) throw Error("PRIVATE_ERROR");
      return response;
    });
    const nodes = await view.click();
    const dialog = nodes.find(node => node.type === view.ui.ReviewDialog && node.props.title === "후기 작성 권한 안내");
    assert.ok(dialog);
    const content = view.flatten(dialog);
    assert.ok(content.some(node => node.props?.role === "alert" && node.props.children === expectedNotice));
    assert.ok(!nodes.some(node => node.type === view.ui.ReviewEditor));
    content.find(node => node.type === "button" && node.props.children === "확인").props.onClick();
    assert.ok(!view.flatten(view.render()).some(node => node.type === view.ui.ReviewDialog && node.props.title === "후기 작성 권한 안내"));
  });
}

test("login return reconciles server props and closes old login dialog", async () => {
  const view = screen("anonymous", async () => ({ userId: null, permission: "anonymous" }));
  assert.ok((await view.click()).some(node => node.type === view.ui.ReviewDialog && node.props.title === "로그인이 필요합니다"));
  const nodes = view.updateProps({ userId: id, permission: "unapproved" });
  assert.ok(!nodes.some(node => node.type === view.ui.ReviewDialog));
  assert.ok(!nodes.some(node => node.props?.children === types.reviewApprovalNotice));
});
test("login link dismisses old dialog before navigation", async () => {
  const view = screen("anonymous", async () => ({ userId: null, permission: "anonymous" }));
  const nodes = await view.click();
  nodes.find(node => node.props?.href === "/auth/login?returnTo=history").props.onClick();
  assert.ok(!view.flatten(view.render()).some(node => node.type === view.ui.ReviewDialog));
});
for (const permission of ["approved", "unapproved", "error"]) {
  test(`stale anonymous screen rechecks actual server status: ${permission}`, async () => {
    const view = screen("anonymous", async () => ({ userId: id, permission }));
    const nodes = await view.click();
    assert.ok(!nodes.some(node => node.type === view.ui.ReviewDialog && node.props.title === "로그인이 필요합니다"));
    assert.equal(nodes.some(node => node.type === view.ui.ReviewEditor), permission === "approved");
    if (permission !== "approved") assert.ok(nodes.some(node => node.props?.role === "alert" && node.props.children === (permission === "unapproved" ? types.reviewApprovalNotice : types.reviewApprovalError)));
  });
}
test("auth lookup failures without a user are errors, missing session stays anonymous", async () => {
  assert.equal((await setup({ user: null, authError: { name: "AuthApiError", code: "bad_jwt" } }).getReviewAccess()).permission, "error");
  assert.equal((await setup({ user: null, authError: { name: "AuthSessionMissingError" } }).getReviewAccess()).permission, "anonymous");
});
