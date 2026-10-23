import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // These photo-only Node scripts intentionally remain CommonJS. All other rules
  // and all files outside this explicit list retain the shared project settings.
  {
    name: "history-photo-commonjs-scripts",
    files: [
      "services/history-photo-broker/build.cjs",
      "services/history-photo-broker/integration.cjs",
      "services/history-photo-broker/local-lab-adapter.cjs",
      "services/history-photo-broker/main.cjs",
      "supabase/install/history-photos/audit-local.cjs",
      "supabase/install/history-photos/create-clean-lab.cjs",
      "supabase/install/history-photos/install-local.cjs",
      "supabase/install/history-photos/owner-hardening/apply-local.cjs",
      "supabase/install/history-photos/owner-hardening/test-local.cjs",
      "supabase/install/history-photos/receipt-generations/apply-local.cjs",
      "supabase/install/history-photos/receipt-generations/audit-local.cjs",
      "supabase/install/history-photos/receipt-generations/resume-local.cjs",
      "supabase/install/history-photos/receipt-generations/test-local.cjs",
      "supabase/install/history-photos/receipt-lookup/apply-local.cjs",
      "supabase/install/history-photos/test-clean-lab.cjs",
      "supabase/local/photo-contract-validation/run-test.cjs",
      "supabase/local/server-db-contract/read-only.cjs",
      "supabase/local/verified-finalization/run.cjs"
],
    languageOptions: { sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
