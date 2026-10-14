import assert from "node:assert/strict";
import { test } from "node:test";
import { load } from "./helpers/load-typescript.mjs";

const options = load("src/lib/signup-options.ts");
const { validateSignup, readSignupForm } = load("src/lib/signup-validation.ts", { "./signup-options": options });
const policy = { today: "2026-10-15" };

function validInput() {
  return {
    email: " member@example.test ", password: "test-password", passwordConfirmation: "test-password",
    name: " Test Member ", callingCode: "82", phoneNumber: "10-1234-5678", nationality: "KR",
    gender: "undisclosed", birthDate: "2000-02-29", koreanLevel: "native",
    foreignLanguages: [{ language: "en", level: "conversational" }], privacyConsent: true,
  };
}

test("valid profile is normalized and excludes password/confirmation from output", () => {
  const result = validateSignup(validInput(), policy);
  assert.equal(Object.keys(result.errors).length, 0);
  assert.equal(result.profile.name, "Test Member");
  assert.equal(result.profile.email, "member@example.test");
  assert.equal(result.profile.phoneNumber, "1012345678");
  assert.equal("password" in result.profile, false);
  assert.equal("passwordConfirmation" in result.profile, false);
});

for (const [field, value] of [
  ["email", "not-email"], ["email", "x".repeat(255) + "@example.test"],
  ["password", "short"], ["password", "x".repeat(129)], ["passwordConfirmation", "different"],
  ["name", "   "], ["name", "x".repeat(101)], ["name", "a\u0000b"],
  ["callingCode", "0"], ["callingCode", "+82"], ["callingCode", "1234"],
  ["phoneNumber", "not-a-phone"], ["phoneNumber", "12"], ["phoneNumber", "1".repeat(16)],
  ["nationality", "XX"], ["gender", "admin"], ["birthDate", "2026-10-16"],
  ["birthDate", "2023-02-29"], ["birthDate", "2026-13-01"], ["birthDate", "0000-01-01"],
  ["koreanLevel", "administrator"], ["privacyConsent", false],
]) {
  test("rejects invalid " + field + " value " + (field === "password" ? "(redacted test value)" : String(value).slice(0, 25)), () => {
    const result = validateSignup({ ...validInput(), [field]: value }, policy);
    assert.ok(result.errors[field], field);
    assert.equal(result.profile, null);
  });
}

test("accepts all allowed genders, five Korean levels, and four foreign levels", () => {
  for (const gender of options.GENDERS) {
    for (const korean of options.KOREAN_LANGUAGE_LEVELS) {
      for (const level of options.FOREIGN_LANGUAGE_LEVELS) {
      const input = { ...validInput(), gender: gender.value, koreanLevel: korean.value,
        foreignLanguages: [{ language: "ja", level: level.value }] };
      assert.equal(Object.keys(validateSignup(input, policy).errors).length, 0);
      }
    }
  }
});

test("one through five distinct foreign languages are allowed; zero/six are rejected", () => {
  for (let count = 0; count <= 6; count++) {
    const foreignLanguages = options.FOREIGN_LANGUAGES.slice(0, count).map(([language], i) => ({
      language, level: options.FOREIGN_LANGUAGE_LEVELS[i % options.FOREIGN_LANGUAGE_LEVELS.length].value,
    }));
    const result = validateSignup({ ...validInput(), foreignLanguages }, policy);
    assert.equal(Boolean(result.errors.foreignLanguages), count === 0 || count === 6);
  }
});

test("duplicate, unknown, Korean, and invalid-level foreign language entries are rejected", () => {
  for (const foreignLanguages of [
    [{ language: "en", level: "native" }, { language: "en", level: "basic" }],
    [{ language: "ko", level: "native" }],
    [{ language: "unknown", level: "native" }],
    [{ language: "en", level: "administrator" }],
    [{ language: "en", level: "none" }],
  ]) {
    assert.ok(Object.keys(validateSignup({ ...validInput(), foreignLanguages }, policy).errors).some(key => key.startsWith("foreignLanguages.")));
  }
});

test("the local preview can validate fields without pretending to collect consent", () => {
  const input = { ...validInput(), privacyConsent: false };
  assert.ok(validateSignup(input, policy).errors.privacyConsent);
  assert.equal(Object.keys(validateSignup(input, { ...policy, requireConsent: false }).errors).length, 0);
});

test("FormData parsing handles custom country codes and missing language levels", () => {
  const form = new FormData();
  for (const [key, value] of Object.entries(validInput())) {
    if (key !== "foreignLanguages" && key !== "privacyConsent") form.set(key, value);
  }
  form.set("callingCode", "other");
  form.set("customCallingCode", "254");
  form.set("privacyConsent", "on");
  form.append("foreignLanguage", "en");
  const input = readSignupForm(form);
  assert.equal(input.callingCode, "254");
  assert.equal(input.privacyConsent, true);
  assert.equal(input.foreignLanguages.length, 1);
  assert.equal(input.foreignLanguages[0].level, "");
  assert.ok(validateSignup(input, policy).errors["foreignLanguages.0.level"]);
});

test("country and language catalogs use stable unique codes", () => {
  assert.equal(options.COUNTRY_CODES.length, 249);
  assert.equal(new Set(options.COUNTRY_CODES).size, 249);
  assert.ok(options.COUNTRY_CODES.includes("KR"));
  assert.ok(options.COUNTRY_CODES.includes("US"));
  assert.equal(options.FOREIGN_LANGUAGES.some(([code]) => code === "ko"), false);
  assert.equal(new Set(options.FOREIGN_LANGUAGES.map(([code]) => code)).size, options.FOREIGN_LANGUAGES.length);
  assert.equal(options.getCountryOptions()[0].label, "대한민국");
});

test("Korean retains none while new foreign-language input rejects it without mutating legacy data", () => {
  assert.equal(options.KOREAN_LANGUAGE_LEVELS.length, 5);
  assert.equal(options.FOREIGN_LANGUAGE_LEVELS.length, 4);
  assert.equal(options.KOREAN_LANGUAGE_LEVELS[0].value, "none");
  assert.deepEqual(Array.from(options.FOREIGN_LANGUAGE_LEVELS, level => level.value), ["basic", "conversational", "fluent", "native"]);
  const legacy = { ...validInput(), koreanLevel: "none", foreignLanguages: [{ language: "en", level: "none" }] };
  const before = JSON.stringify(legacy);
  const result = validateSignup(legacy, policy);
  assert.equal(result.errors.koreanLevel, undefined);
  assert.ok(result.errors["foreignLanguages.0.level"]);
  assert.equal(JSON.stringify(legacy), before);
});
