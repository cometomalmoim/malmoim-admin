import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
function load(name, mocks = {}) {
  const file = path.resolve(root, name);
  const loaded = { exports: {} };
  const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  runInNewContext(outputText, { module: loaded, exports: loaded.exports, FormData, Date, Intl, console, process: { env: { NODE_ENV: "test" } },
    require: id => Object.hasOwn(mocks, id) ? mocks[id] :
      id.startsWith("@/") ? load("src/" + id.slice(2) + ".ts", mocks) : id.startsWith(".") ? load(path.relative(root, path.resolve(path.dirname(file), id + ".ts")), mocks) : require(id),
  });
  return loaded.exports;
}
const options = load("src/lib/signup-options.ts");
const { validateSignup, readSignupForm } = load("src/lib/signup-validation.ts");
const { registerMember } = load("src/lib/member-registration.ts");
const valid = () => ({
  email: " member@example.test ", password: "test-only-Password1!", passwordConfirmation: "test-only-Password1!",
  name: "테스트", callingCode: "82", phoneNumber: "010-0000-0000", nationality: "KR",
  gender: "undisclosed", birthDate: "2000-01-01", koreanLevel: "none", englishLevel: "none",
  foreignLanguages: [{ language: "ja", level: "basic" }], privacyConsent: true,
});
const policy = { minPasswordLength: 8, requiredFields: [], consentVersion: "test-policy-only" };
function backend(overrides = {}) {
  const calls = [];
  const api = {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      signUp: async input => {
        calls.push(["signUp", input]);
        return { data: { user: { id: "user-a" }, session: {} }, error: null };
      },
    },
    rpc: async (name, args) => {
      calls.push([name, args]);
      return { data: name === "member_registration_ready" ? policy.consentVersion : "user-a", error: null };
    },
    ...overrides,
  };
  return { api, calls };
}
test("countries are unique ISO alpha-2 codes; Korean and foreign levels stay separate", () => {
  assert.equal(options.COUNTRY_CODES.length, 249);
  assert.equal(new Set(options.COUNTRY_CODES).size, 249);
  assert.equal(options.KOREAN_LEVELS.length, 5);
  assert.equal(options.ENGLISH_LEVELS.length, 5);
  assert.equal(options.FOREIGN_LEVELS.length, 4);
  assert.ok(!options.FOREIGN_LEVELS.some(level => level.value === "none"));
  assert.ok(!options.FOREIGN_LANGUAGES.some(([code]) => code === "ko" || code === "en"));
});
test("valid form normalizes phone/email without including passwords in profile", () => {
  const result = validateSignup(valid());
  assert.equal(Object.keys(result.errors).length, 0);
  assert.equal(result.profile.email, "member@example.test");
  assert.equal(result.profile.phoneNumber, "1000000000");
  assert.equal("password" in result.profile, false);
  assert.equal("passwordConfirmation" in result.profile, false);
});
test("email, confirmation, dates, country, gender, phone and length are validated", () => {
  for (const change of [
    { email: "bad" }, { email: "a".repeat(255) + "@example.test" }, { passwordConfirmation: "mismatch" },
    { birthDate: "2999-01-01" }, { birthDate: "2023-02-29" }, { birthDate: "0000-01-01" },
    { nationality: "ZZ" }, { gender: "invalid" }, { callingCode: "0" }, { phoneNumber: "abc" },
    { phoneNumber: "1".repeat(20) }, { name: "a".repeat(101) },
  ]) assert.ok(Object.keys(validateSignup({ ...valid(), ...change }).errors).length > 0, JSON.stringify(change));
});
test("unapproved collection requirements are not fabricated; configured requirements apply", () => {
  const input = { ...valid(), name: "", phoneNumber: "", nationality: "", gender: "", birthDate: "" };
  assert.ok(validateSignup(input).profile);
  assert.ok(validateSignup(input, { requiredFields: ["name", "birthDate"] }).errors.name);
  assert.ok(validateSignup(input, { requiredFields: ["name", "birthDate"] }).errors.birthDate);
  assert.ok(validateSignup({ ...valid(), password: "short", passwordConfirmation: "short" }, { minPasswordLength: 8 }).errors.password);
});
test("zero to three additional languages validate; four, duplicates, ko/en and none fail", () => {
  const codes = ["ja", "zh", "fr", "de"];
  for (let size = 0; size <= 3; size++)
    assert.ok(validateSignup({ ...valid(), foreignLanguages: codes.slice(0, size).map(language => ({ language, level: "fluent" })) }).profile);
  for (const foreignLanguages of [
    codes.map(language => ({ language, level: "basic" })),
    [{ language: "ja", level: "basic" }, { language: "ja", level: "native" }],
    [{ language: "ko", level: "native" }], [{ language: "en", level: "native" }],
    [{ language: "ja", level: "none" }], [{ language: "zz", level: "fluent" }],
  ]) assert.equal(validateSignup({ ...valid(), foreignLanguages }).profile, null);
});
test("Korean and English independently accept five levels and require an explicit answer", () => {
  for (const koreanLevel of ["none", "basic", "conversational", "fluent", "native"])
    for (const englishLevel of ["none", "basic", "conversational", "fluent", "native"]) {
      const result = validateSignup({ ...valid(), koreanLevel, englishLevel, foreignLanguages: [] });
      assert.equal(result.profile.koreanLevel, koreanLevel);
      assert.equal(result.profile.englishLevel, englishLevel);
    }
  for (const field of ["koreanLevel", "englishLevel"])
    for (const value of ["", "unknown"]) assert.ok(validateSignup({ ...valid(), [field]: value }).errors[field]);
});
test("server reads all repeated rows including malformed unequal arrays", () => {
  const form = new FormData();
  form.append("foreignLanguage", "en"); form.append("foreignLanguage", "ja"); form.append("foreignLevel", "basic");
  form.set("callingCode", "other"); form.set("customCallingCode", "254");
  const input = readSignupForm(form);
  assert.equal(input.foreignLanguages.length, 2);
  assert.equal(input.foreignLanguages[1].level, "");
  assert.equal(input.callingCode, "254");
});
test("policy gate blocks before contacting Auth or DB", async () => {
  const api = { auth: { getUser: () => assert.fail("Must not contact Auth") }, rpc: () => assert.fail("Must not contact DB") };
  assert.equal((await registerMember(valid(), api, null)).status, "blocked");
  const action = load("src/app/actions/member-registration.ts", {
    "@/lib/supabase/server": { createClient: () => assert.fail("Must not create client") },
    "@/lib/member-registration-policy": { memberRegistrationPolicy: null },
    "@/lib/member-registration": { registerMember },
    "@/lib/signup-validation": { readSignupForm },
  });
  assert.equal((await action.signup(new FormData())).status, "blocked");
});
test("missing migration or consent version blocks before account creation", async () => {
  for (const result of [{ data: null, error: { code: "PGRST202" } }, { data: "wrong", error: null }]) {
    const { api, calls } = backend({ rpc: async () => result });
    assert.equal((await registerMember(valid(), api, policy)).status, "blocked");
    assert.equal(calls.length, 0);
  }
});
test("invalid consent, repeated language or password is rejected server-side", async () => {
  for (const input of [{ ...valid(), privacyConsent: false }, { ...valid(), passwordConfirmation: "bad" },
    { ...valid(), foreignLanguages: Array(6).fill({ language: "en", level: "none" }) }]) {
    const { api, calls } = backend();
    assert.equal((await registerMember(input, api, policy)).status, "invalid");
    assert.equal(calls.length, 0);
  }
});
test("email confirmation without a session never saves a profile or claims completion", async () => {
  const { api, calls } = backend();
  api.auth.signUp = async () => ({ data: { user: { id: "unverified" }, session: null }, error: null });
  const result = await registerMember(valid(), api, policy);
  assert.equal(result.status, "confirmation");
  assert.match(result.message, /아직 저장되지/);
  assert.ok(!calls.some(([name]) => name === "save_member_profile"));
});
test("verified signup uses one atomic profile RPC and sends no password or owner field", async () => {
  const { api, calls } = backend();
  let count = 0;
  api.auth.getUser = async () => ({ data: { user: count++ ? { id: "user-a" } : null }, error: null });
  assert.equal((await registerMember(valid(), api, policy)).status, "complete");
  const writes = calls.filter(([name]) => name === "save_member_profile");
  assert.equal(writes.length, 1);
  const args = writes[0][1];
  assert.equal(args.p_languages.length, 1);
  assert.equal(args.p_profile.korean_proficiency, "none");
  assert.equal(args.p_profile.english_proficiency, "none");
  assert.equal("user_id" in args.p_profile, false);
  assert.equal("password" in args.p_profile, false);
  assert.equal(args.p_profile.phone_number, "1000000000");
});
test("partial failure is explicitly pending and signed-in users can retry without Auth creation", async () => {
  const { api } = backend();
  api.auth.getUser = async () => ({ data: { user: { id: "user-a" } }, error: null });
  api.auth.signUp = () => assert.fail("Must not create another account");
  api.rpc = async name => ({ data: name === "member_registration_ready" ? policy.consentVersion : null,
    error: name === "member_registration_ready" ? null : { code: "23514" } });
  const input = { ...valid(), email: "", password: "", passwordConfirmation: "" };
  assert.equal((await registerMember(input, api, policy)).status, "profile_pending");
  api.rpc = async name => ({ data: name === "member_registration_ready" ? policy.consentVersion : "user-a", error: null });
  assert.equal((await registerMember(input, api, policy)).status, "complete");
});
test("Auth rejection or uncertain identity cannot trigger profile writes", async () => {
  for (const failure of [{ code: "weak_password" }, { status: 429 }, { status: 500 }]) {
    const { api, calls } = backend();
    api.auth.signUp = async () => ({ data: { user: null, session: null }, error: failure });
    assert.equal((await registerMember(valid(), api, policy)).status, "error");
    assert.ok(!calls.some(([name]) => name === "save_member_profile"));
  }
  const { api, calls } = backend();
  assert.equal((await registerMember(valid(), api, policy)).status, "profile_pending");
  assert.ok(!calls.some(([name]) => name === "save_member_profile"));
});
test("existing session network failure stops registration instead of creating an account", async () => {
  const { api, calls } = backend();
  api.auth.getUser = async () => ({ data: { user: null }, error: { name: "AuthRetryableFetchError" } });
  assert.equal((await registerMember(valid(), api, policy)).status, "error");
  assert.equal(calls.length, 0);
});
test("public logout shares local session with a home redirect; admin logout stays separate", async () => {
  const redirects = [];
  const actions = load("src/app/actions/auth.ts", {
    "@/lib/supabase/config": { SupabaseConfigError: class extends Error {} },
    "@supabase/supabase-js": { isAuthRetryableFetchError: () => false },
    "next/navigation": { redirect: path => { redirects.push(path); throw new Error("redirect"); } },
    "@/lib/supabase/server": { createClient: async () => ({ auth: {
      signOut: async ({ scope }) => { assert.equal(scope, "local"); return { error: null }; },
    } }) },
  });
  await assert.rejects(actions.memberLogout(), /redirect/);
  await assert.rejects(actions.logout(), /redirect/);
  assert.deepEqual(redirects, ["/", "/login"]);
});

test("requested password policy rejects each missing character class and passwords under eight", () => {
  for (const password of ["Aa1!bbb", "1234567!", "abcdefgh!", "abcdefgh1", "Abcdef1 ", "Abcdef1한"]) {
    assert.ok(validateSignup({ ...valid(), password, passwordConfirmation: password }).errors.password);
  }
  for (const password of ["abcd123!", "ABC123!?", "Abc 123!"]) {
    assert.ok(validateSignup({ ...valid(), password, passwordConfirmation: password }).profile);
  }
});

test("public account uses a verified server user and fails closed on invalid session", async () => {
  const cookie = { name: "sb-test-auth-token", value: "test-only" };
  const getAccount = async (cookies, result) => {
    let calls = 0;
    const { PublicAccount } = load("src/components/public-account.tsx", {
      "next/headers": { cookies: async () => ({ getAll: () => cookies }) },
      "@/lib/supabase/server": { createClient: async () => { calls++; return { auth: { getUser: async () => result } }; } },
      "./profile-menu": { ProfileMenu: "TestProfile" },
      "next/link": { __esModule: true, default: "a" },
    });
    return { element: await PublicAccount({ locale: "ko" }), calls };
  };
  const anon = await getAccount([], null);
  assert.equal(anon.calls, 0);
  assert.equal(anon.element.props.href, "/auth/login");
  const user = await getAccount([cookie], { data: { user: { email: "test@example.test" } }, error: null });
  assert.equal(user.element.props.email, "test@example.test");
  const denied = await getAccount([cookie], { data: { user: { email: "untrusted@example.test" } }, error: {} });
  assert.equal(denied.element.props.href, "/auth/login");
  assert.equal(denied.element.props.email, undefined);
});
test("homepage now refreshes SSR cookies; admin host redirect and private cache are preserved", async () => {
  let refreshed = 0;
  const response = () => ({ cookies: { set: () => {} }, headers: new Map() });
  const { proxy } = load("src/proxy.ts", {
    "@/lib/domain-routing": { isAdminRoot: (host, path) => host === "admin.malmoim.com" && path === "/" },
    "@/lib/supabase/config": { getSupabaseConfig: () => ({ url: "https://test.invalid", key: "test-only" }) },
    "@supabase/ssr": { createServerClient: (_url, _key, options) => ({ auth: {
      getClaims: async () => { refreshed++; options.cookies.setAll([{ name: "test-only", value: "test", options: {} }]); },
    } }) },
    "next/server": { NextResponse: { next: response, redirect: url => ({ ...response(), destination: url.pathname }) } },
  });
  const request = host => ({ nextUrl: { pathname: "/", clone: () => ({ pathname: "/" }) },
    headers: { get: () => host }, cookies: { getAll: () => [], set: () => {} } });
  const home = await proxy(request("localhost"));
  assert.equal(refreshed, 1);
  assert.match(home.headers.get("Cache-Control"), /private, no-store/);
  const admin = await proxy(request("admin.malmoim.com"));
  assert.equal(admin.destination, "/login");
  assert.equal(refreshed, 1);
});

const localeTools = load("src/lib/public-locale.ts");
test("locale routing preserves corresponding auth pages and excludes admin/independent event pages", () => {
  for (const path of ["/", "/about", "/events", "/exchange", "/board", "/history", "/auth/login", "/signup"]) {
    const enPath = path === "/" ? "/en" : "/en" + path;
    assert.equal(localeTools.localizedPublicPath(path, "en"), enPath);
    assert.equal(localeTools.localizedPublicPath(enPath, "ko"), path);
    assert.equal(localeTools.publicLocaleDecision(path, "en").pathname, enPath);
    assert.equal(localeTools.publicLocaleDecision(enPath, "en", "ko").pathname, path);
    assert.equal(localeTools.publicLocaleDecision(enPath, "ko").locale, "en");
  }
  for (const path of ["/login", "/admin", "/admin/users", "/season9", "/en/season9", "/2026halloweenparty", "/en/missing"])
    assert.equal(localeTools.publicLocaleDecision(path, "en", "en"), null);
  assert.equal(localeTools.parsePublicLocale("https://invalid.test"), "ko");
});
test("English form messages and option labels are localized without changing stored codes", () => {
  const errors = validateSignup({ ...valid(), email: "invalid", password: "x", passwordConfirmation: "",
    nationality: "ZZ", gender: "other", koreanLevel: "", englishLevel: "", birthDate: "2999-01-01",
    foreignLanguages: [{ language: "en", level: "none" }] }, { locale: "en" }).errors;
  assert.ok(Object.keys(errors).length >= 8);
  for (const value of Object.values(errors)) assert.doesNotMatch(value, /[가-힣]/);
  assert.equal(options.getCountryOptions("en").length, 249);
  assert.equal(options.getForeignLanguageOptions("en").length, 35);
  for (const item of [...options.getCountryOptions("en"), ...options.getForeignLanguageOptions("en"), ...options.getCallingCodeOptions("en")])
    assert.doesNotMatch(item.label, /[가-힣]/);
});
test("empty additional-language list and both fixed levels are passed in one atomic RPC", async () => {
  const { api, calls } = backend();
  api.auth.getUser = async () => ({ data: { user: { id: "user-a" } }, error: null });
  api.auth.signUp = () => assert.fail("Existing member must not create another account");
  const input = { ...valid(), koreanLevel: "basic", englishLevel: "none", foreignLanguages: [] };
  assert.equal((await registerMember(input, api, policy, "en")).status, "complete");
  const args = calls.find(([name]) => name === "save_member_profile")[1];
  assert.equal(args.p_profile.korean_proficiency, "basic");
  assert.equal(args.p_profile.english_proficiency, "none");
  assert.equal(args.p_languages.length, 0);
});
test("English signup blocked, confirmation and partial-failure messages stay English", async () => {
  const closed = await registerMember(valid(), backend().api, null, "en");
  assert.equal(closed.status, "blocked");
  assert.doesNotMatch(closed.message, /[가-힣]/);
  const { api } = backend();
  api.auth.signUp = async () => ({ data: { user: { id: "user-a" }, session: null }, error: null });
  const confirmation = await registerMember(valid(), api, policy, "en");
  assert.equal(confirmation.status, "confirmation");
  assert.doesNotMatch(confirmation.message, /[가-힣]/);
  api.auth.getUser = async () => ({ data: { user: { id: "user-a" } }, error: null });
  api.rpc = async name => ({ data: name === "member_registration_ready" ? policy.consentVersion : null,
    error: name === "member_registration_ready" ? null : { code: "23514" } });
  const pending = await registerMember(valid(), api, policy, "en");
  assert.equal(pending.status, "profile_pending");
  assert.doesNotMatch(pending.message, /[가-힣]/);
});
test("public Auth redirects retain English while admin routes stay fixed", async () => {
  let failure = null;
  const actions = load("src/app/actions/auth.ts", {
    "@/lib/supabase/config": { SupabaseConfigError: class extends Error {} },
    "@supabase/supabase-js": { isAuthRetryableFetchError: () => false },
    "next/navigation": { redirect: path => { throw new Error("REDIRECT:" + path); } },
    "@/lib/supabase/server": { createClient: async () => ({ auth: {
      signInWithPassword: async () => ({ error: failure }), signOut: async () => ({ error: failure }),
    } }) },
  });
  const form = new FormData();
  form.set("email", "test@example.test"); form.set("password", "test-only"); form.set("locale", "en");
  await assert.rejects(actions.memberLogin({}, form), /REDIRECT:\/en$/);
  await assert.rejects(actions.memberLogout({}, form), /REDIRECT:\/en$/);
  await assert.rejects(actions.login({}, form), /REDIRECT:\/admin$/);
  await assert.rejects(actions.logout(), /REDIRECT:\/login$/);
  failure = { status: 400, code: "invalid_credentials" };
  assert.doesNotMatch((await actions.memberLogin({}, form)).message, /[가-힣]/);
  assert.doesNotMatch((await actions.memberLogout({}, form)).message, /[가-힣]/);
  assert.match((await actions.login({}, form)).message, /[가-힣]/);
});
test("proxy persists language selection, redirects only supported GET routes and preserves Auth refresh cookies", async () => {
  function response() { return { cookies: { values: new Map(), set(name, value) { this.values.set(name, value); } }, headers: new Map() }; }
  const { proxy } = load("src/proxy.ts", {
    "@/lib/domain-routing": { isAdminRoot: (host, path) => host === "admin.malmoim.com" && path === "/" },
    "@/lib/supabase/config": { getSupabaseConfig: () => ({ url: "https://test.invalid", key: "test-only" }) },
    "@supabase/ssr": { createServerClient: (_url, _key, options) => ({ auth: { getClaims: async () =>
      options.cookies.setAll([{ name: "sb-test-auth-token", value: "test-only", options: {} }]) } }) },
    "next/server": { NextResponse: { next: response, redirect: url => ({ ...response(), destination: url.pathname, search: url.search }) } },
  });
  function request(path, preference = "en", method = "GET") {
    const url = new URL("https://example.test" + path);
    url.clone = () => new URL(url);
    return { method, nextUrl: url, headers: { get: () => "example.test" },
      cookies: { get: name => name === "malmoim_locale" ? { value: preference } : undefined, getAll: () => [], set: () => {} } };
  }
  const english = await proxy(request("/signup"));
  assert.equal(english.destination, "/en/signup");
  assert.equal(english.cookies.values.get("malmoim_locale"), "en");
  const korean = await proxy(request("/signup?lang=ko"));
  assert.equal(korean.destination, "/signup");
  assert.equal(korean.search, "");
  assert.equal(korean.cookies.values.get("malmoim_locale"), "ko");
  const regular = await proxy(request("/en/auth/login"));
  assert.equal(regular.cookies.values.get("malmoim_locale"), "en");
  assert.equal(regular.cookies.values.get("sb-test-auth-token"), "test-only");
  const admin = await proxy(request("/login?lang=en"));
  assert.equal(admin.destination, undefined);
  assert.equal(admin.cookies.values.has("malmoim_locale"), false);
  const post = await proxy(request("/signup", "en", "POST"));
  assert.equal(post.destination, undefined);
});

test("Korean calendar date changes exactly at Seoul midnight regardless of host timezone", () => {
  const cases = [
    ["2026-10-15T14:59:59.999Z", "2026-10-15"],
    ["2026-10-15T15:00:00.000Z", "2026-10-16"],
    ["2026-12-31T14:59:59.999Z", "2026-12-31"],
    ["2026-12-31T15:00:00.000Z", "2027-01-01"],
    ["2024-02-28T15:00:00.000Z", "2024-02-29"],
  ];
  for (const [instant, expected] of cases) {
    const today = options.getTodayInKorea(new Date(instant));
    assert.equal(today, expected);
    assert.ok(validateSignup({ ...valid(), birthDate: expected }, { today }).profile);
  }
  assert.ok(validateSignup({ ...valid(), birthDate: "2026-10-16" },
    { today: options.getTodayInKorea(new Date("2026-10-15T14:59:59.999Z")) }).errors.birthDate);
  assert.ok(validateSignup({ ...valid(), birthDate: "2026-10-16" },
    { today: options.getTodayInKorea(new Date("2026-10-15T15:00:00.000Z")) }).profile);
});

test("signup waits for the request before reading time even if Supabase configuration fails", async () => {
  let release;
  let dateReads = 0;
  const connected = new Promise(resolve => { release = resolve; });
  const { MemberSignupPage } = load("src/components/member-signup-page.tsx", {
    "next/server": { connection: () => connected },
    "next/link": { __esModule: true, default: "a" },
    "@/lib/supabase/server": { createClient: async () => { throw new Error("Test configuration unavailable"); } },
    "@/lib/member-registration-policy": { memberRegistrationPolicy: null },
    "@/lib/signup-options": { getCountryOptions: () => [], getTodayInKorea: () => {
      dateReads++; return options.getTodayInKorea(new Date("2026-10-15T15:00:00Z"));
    } },
    "./signup-form": { SignupForm: "TestSignupForm" },
    "@/app/(public)/signup/signup.css": {},
  });
  for (const locale of ["ko", "en"]) {
    const page = MemberSignupPage({ locale });
    const suspense = page.props.children.at(-1);
    const child = suspense.props.children;
    const content = child.type(child.props);
    if (locale === "ko") {
      assert.equal(dateReads, 0);
      release();
    }
    const form = await content;
    assert.equal(form.props.today, "2026-10-16");
    assert.equal(form.props.locale, locale);
  }
  assert.equal(dateReads, 2);
});

test("server ignores a forged client date and rejects future birth before Auth creation or saving", async () => {
  const form = new FormData();
  for (const [key, value] of Object.entries(valid())) {
    if (typeof value === "string") form.set(key, value);
  }
  form.set("birthDate", "9999-12-31");
  form.set("today", "9999-12-31");
  form.set("privacyConsent", "on");
  const input = readSignupForm(form);
  assert.equal("today" in input, false);
  const { api, calls } = backend();
  const result = await registerMember(input, api, policy);
  assert.equal(result.status, "invalid");
  assert.ok(result.errors.birthDate);
  assert.equal(calls.length, 0);
});
