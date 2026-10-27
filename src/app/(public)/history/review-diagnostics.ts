import "server-only";

/** Log bounded diagnostic codes only: never SQL details, records or credentials. */
export function logReviewFailure(stage: "list" | "eligibility", error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  const known = ["42P01", "42703", "42501", "42883", "PGRST202", "PGRST204", "PGRST205"];
  console.error("[history-reviews]", { stage, code: typeof code === "string" && known.includes(code) ? code : "UNKNOWN" });
}
