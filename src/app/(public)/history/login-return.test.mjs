import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
function load(file, mocks) {
  const loaded = { exports: {} };
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
  runInNewContext(outputText, { exports: loaded.exports, module: loaded, require(key) { assert.ok(key in mocks, `Unexpected import: ${key}`); return mocks[key]; } });
  return loaded.exports;
}
function auth(error = null) {
  return load("../../actions/auth.ts", {
    "@/lib/member-messages": { memberText: (_, text) => text },
    "@/lib/public-locale": load("../../../lib/public-locale.ts", {}),
    "@/lib/supabase/config": { SupabaseConfigError: class extends Error {} },
    "@supabase/supabase-js": { isAuthRetryableFetchError: () => false },
    "next/navigation": { redirect(path) { throw Object.assign(new Error("REDIRECT"), { destination: path }); } },
    "@/lib/supabase/server": { createClient: async () => ({ auth: { signInWithPassword: async () => ({ error }) } }) },
  });
}
function form(returnTo, locale = "ko") {
  const data = new FormData(); data.set("email", "mock@example.invalid"); data.set("password", "mock-only"); data.set("locale", locale);
  if (returnTo !== undefined) data.set("returnTo", returnTo);
  return data;
}
for (const value of [undefined, "history", "https://example.invalid", "//example.invalid", "/history", "History", " history", "admin"]) {
  test(`member return allowlist: ${String(value)}`, async () => {
    await assert.rejects(auth().memberLogin({}, form(value)), error => error.destination === (value === "history" ? "/history" : "/"));
  });
}
test("English home fallback and admin destination stay unchanged", async () => {
  await assert.rejects(auth().memberLogin({}, form(undefined, "en")), error => error.destination === "/en");
  await assert.rejects(auth().login({}, form("history")), error => error.destination === "/admin");
});
test("login failure keeps form return value and does not redirect", async () => {
  const data = form("history");
  const result = await auth({ status: 400 }).memberLogin({}, data);
  assert.ok(result.message); assert.equal(data.get("returnTo"), "history");
});
test("English history return preserves language", async () => {
 await assert.rejects(auth().memberLogin({}, form("history", "en")), error => error.destination === "/en/history");
});
