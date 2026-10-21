import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, mocks) {
  const { outputText } = ts.transpileModule(readFileSync(new URL("../" + file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const loaded = { exports: {} };
  runInNewContext(outputText, {
    module: loaded, exports: loaded.exports, process: { env: { NODE_ENV: "test" } },
    require: name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith("@/lib/") ? load("src/lib/" + name.slice(6) + ".ts", mocks) : require(name),
  });
  return loaded.exports;
}
class Redirect extends Error { constructor(path) { super(path); this.path = path; } }
class SupabaseConfigError extends Error {}
function actions(auth, configurationFailure = false) {
  return load("src/app/actions/auth.ts", {
    "@/lib/supabase/config": { SupabaseConfigError },
    "@supabase/supabase-js": { isAuthRetryableFetchError: error => error.retryable === true },
    "next/navigation": { redirect: path => { throw new Redirect(path); } },
    "@/lib/supabase/server": { createClient: async () => {
      if (configurationFailure) throw new SupabaseConfigError();
      return { auth };
    } },
  });
}
function form(email = " member@example.test ", password = "test-only-password") {
  const data = new FormData(); data.set("email", email); data.set("password", password); return data;
}
for (const [action, destination] of [["login", "/admin"], ["memberLogin", "/"]]) {
  test(action + " reuses password authentication and keeps its fixed destination", async () => {
    let calls = 0;
    const api = actions({ signInWithPassword: async ({ email, password }) => {
      calls++;
      assert.equal(email, "member@example.test");
      assert.equal(password, "test-only-password");
      return { error: null };
    } });
    await assert.rejects(api[action]({}, form()), error => error instanceof Redirect && error.path === destination);
    assert.equal(calls, 1);
  });
  test(action + " rejects missing or malformed credentials without contacting Supabase", async () => {
    const api = actions({ signInWithPassword: () => assert.fail("Unexpected request") });
    for (const data of [new FormData(), form("invalid"), form("", "x"), form("member@example.test", "")]) {
      assert.match((await api[action]({}, data)).message, /이메일과 비밀번호/);
    }
  });
  test(action + " returns errors instead of redirecting after failed authentication", async () => {
    for (const error of [
      { status: 400, code: "invalid_credentials" }, { status: 400, code: "email_not_confirmed" },
      { status: 429 }, { status: 503 }, { status: 401 }, { retryable: true },
    ]) {
      const api = actions({ signInWithPassword: async () => ({ error }) });
      assert.ok((await api[action]({}, form())).message.length > 0);
    }
    const api = actions({ signInWithPassword: async () => { throw new Error("test unavailable"); } });
    assert.match((await api[action]({}, form())).message, /오류/);
  });
}
test("member configuration errors give a public message; admin messaging is preserved", async () => {
  const api = actions({}, true);
  const member = await api.memberLogin({}, form());
  assert.match(member.message, /잠시 후/);
  assert.doesNotMatch(member.message, /Supabase|env|key|URL/);
  assert.match((await api.login({}, form())).message, /Supabase/);
});
test("member server rejects overlong email input", async () => {
  const api = actions({ signInWithPassword: () => assert.fail("Unexpected request") });
  assert.match((await api.memberLogin({}, form("x".repeat(255) + "@example.test"))).message, /이메일/);
});
test("existing admin logout retains local scope and /login redirect", async () => {
  const api = actions({ signOut: async ({ scope }) => { assert.equal(scope, "local"); return { error: null }; } });
  await assert.rejects(api.logout(), error => error instanceof Redirect && error.path === "/login");
  assert.match((await actions({ signOut: async () => ({ error: {} }) }).logout()).message, /로그아웃하지 못했습니다/);
});
test("the member login route participates in the existing SSR refresh matcher", () => {
  const { config } = load("src/proxy.ts", {
    "@/lib/domain-routing": {}, "@/lib/supabase/config": {}, "@supabase/ssr": {}, "next/server": {},
  });
  for (const route of ["/", "/en/:path*", "/about", "/signup", "/admin/:path*", "/login", "/auth/login"])
    assert.ok(config.matcher.includes(route));
  for (const route of ["/season9", "/2026halloweenparty", "/api", "/_next"])
    assert.ok(!config.matcher.includes(route));
});
test("ordinary accounts still require admin_users registration", async () => {
  const { getAdminAccess } = load("src/lib/auth.ts", {
    "server-only": {},
    "./supabase/server": { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: "test-member" } }, error: null }) },
      from: table => {
        assert.equal(table, "admin_users");
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
      },
    }) },
  });
  assert.equal((await getAdminAccess()).status, "denied");
});

test("member login returns only to a whitelisted board route in the selected language", async () => {
  const api = actions({ signInWithPassword: async () => ({ error: null }) });
  const data = form(); data.set("locale", "en"); data.set("returnTo", "/board/new");
  await assert.rejects(api.memberLogin({}, data), error => error instanceof Redirect && error.path === "/en/board/new");
  for (const value of ["https://evil.test", "//evil.test", "/admin", "/login"]) {
    data.set("returnTo", value);
    await assert.rejects(api.memberLogin({}, data), error => error instanceof Redirect && error.path === "/en");
  }
  await assert.rejects(api.login({}, data), error => error instanceof Redirect && error.path === "/admin");
});
