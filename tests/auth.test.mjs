import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { load } from "./helpers/load-typescript.mjs";

const require = createRequire(import.meta.url);

class Redirect extends Error {
  constructor(path) { super(path); this.path = path; }
}
class SupabaseConfigError extends Error {}

function actions(auth, configError = false) {
  return load("src/app/actions/auth.ts", {
    "@/lib/supabase/config": { SupabaseConfigError },
    "@supabase/supabase-js": { isAuthRetryableFetchError: () => false },
    "next/navigation": { redirect: (path) => { throw new Redirect(path); } },
    "@/lib/supabase/server": {
      createClient: async () => {
        if (configError) throw new SupabaseConfigError();
        return { auth };
      },
    },
  });
}

function credentials(email = " member@example.test ", password = "test-password") {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  return data;
}

for (const [action, destination] of [["login", "/admin"], ["memberLogin", "/"]]) {
  test(action + " authenticates with the shared client and redirects to " + destination, async () => {
    let calls = 0;
    const api = actions({ signInWithPassword: async ({ email, password }) => {
      calls++;
      assert.equal(email, "member@example.test");
      assert.equal(password, "test-password");
      return { error: null };
    } });
    await assert.rejects(api[action]({}, credentials()), (error) => error instanceof Redirect && error.path === destination);
    assert.equal(calls, 1);
  });

  test(action + " rejects invalid input before contacting Supabase", async () => {
    const api = actions({ signInWithPassword: async () => { assert.fail("Unexpected auth call"); } });
    for (const data of [credentials("invalid"), credentials("member@example.test", "")]) {
      assert.match((await api[action]({}, data)).message, /이메일과 비밀번호/);
    }
  });

  test(action + " reports authentication and configuration errors without redirecting", async () => {
    const api = actions({ signInWithPassword: async () => ({ error: { status: 400, code: "invalid_credentials" } }) });
    assert.match((await api[action]({}, credentials())).message, /로그인하지 못했습니다/);
    const unavailable = actions({}, true);
    assert.match((await unavailable[action]({}, credentials())).message, /설정이 누락/);
    const unconfirmed = actions({ signInWithPassword: async () => ({ error: { status: 400, code: "email_not_confirmed" } }) });
    assert.match((await unconfirmed[action]({}, credentials())).message, /이메일 확인/);
  });
}

for (const [action, destination] of [["logout", "/login"], ["memberLogout", "/"]]) {
  test(action + " signs out the local session and preserves its destination", async () => {
    const api = actions({ signOut: async ({ scope }) => {
      assert.equal(scope, "local");
      return { error: null };
    } });
    await assert.rejects(api[action](), (error) => error instanceof Redirect && error.path === destination);
    const failed = actions({ signOut: async () => ({ error: new Error("test failure") }) });
    assert.match((await failed[action]()).message, /로그아웃하지 못했습니다/);
  });
}

test("ordinary accounts remain denied admin access; lookup errors never grant access", async () => {
  for (const [data, error, expected] of [[null, null, "denied"], [null, new Error("lookup failed"), "error"], [{ user_id: "test-user" }, null, "admin"]]) {
    const { getAdminAccess } = load("src/lib/auth.ts", {
      "server-only": {},
      "./supabase/server": { createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: "test-user", email: "member@example.test" } }, error: null }) },
        from: (table) => {
          assert.equal(table, "admin_users");
          return { select: () => ({ eq: (field, value) => {
            assert.equal(field, "user_id");
            assert.equal(value, "test-user");
            return { maybeSingle: async () => ({ data, error }) };
          } }) };
        },
      }) },
    });
    assert.equal((await getAdminAccess()).status, expected);
  }
});

test("public account menu uses a verified user and degrades safely without auth", async () => {
  for (const [user, error] of [[{ email: "member@example.test" }, null], [null, null], [null, new Error("unavailable")]]) {
    const { PublicAccount } = load("src/components/public-account.tsx", {
      "server-only": {},
      "next/link": { default: "a" },
      "./profile-menu": { ProfileMenu: "profile-menu" },
      "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error }) } }) },
    });
    const result = await PublicAccount();
    const content = JSON.stringify(result);
    if (user && !error) {
      assert.match(content, /member@example.test/);
      assert.match(content, /profile-menu/);
    } else {
      assert.match(content, /\/auth\/login/);
      assert.doesNotMatch(content, /member@example.test/);
      assert.doesNotMatch(content, /signup/);
    }
  }
});

test("public homepage refreshes session cookies and keeps responses private", async () => {
  const { NextRequest } = require("next/server");
  let refreshes = 0;
  const { proxy, config } = load("src/proxy.ts", {
    "@/lib/domain-routing": load("src/lib/domain-routing.ts", {}),
    "@/lib/supabase/config": { getSupabaseConfig: () => ({ url: "https://backend.example.test", key: "test-only" }) },
    "@supabase/ssr": { createServerClient: (_url, _key, options) => ({
      auth: { getClaims: async () => {
        refreshes++;
        options.cookies.setAll([{ name: "test-session", value: "test-refreshed", options: { httpOnly: true, sameSite: "lax", path: "/" } }]);
      } },
    }) },
  });
  const request = new NextRequest("http://localhost/");
  const response = await proxy(request);
  assert.equal(refreshes, 1);
  assert.equal(request.cookies.get("test-session").value, "test-refreshed");
  assert.equal(response.cookies.get("test-session").value, "test-refreshed");
  assert.match(response.headers.get("cache-control"), /private.*no-store/);
  assert.equal(response.headers.get("pragma"), "no-cache");
  for (const path of ["/", "/auth/login", "/login", "/admin/:path*", "/about", "/events", "/exchange", "/board", "/history"]) {
    assert.ok(config.matcher.includes(path));
  }
  const adminRoot = await proxy(new NextRequest("https://admin.malmoim.com/", { headers: { host: "admin.malmoim.com" } }));
  assert.equal(adminRoot.status, 307);
  assert.equal(adminRoot.headers.get("location"), "https://admin.malmoim.com/login");
  assert.equal(refreshes, 1);
});
