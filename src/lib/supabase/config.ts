export class SupabaseConfigError extends Error {
  constructor() { super("Supabase 연결 설정을 확인해주세요."); this.name = "SupabaseConfigError"; }
}
type ConnectionPolicy = { nodeEnv?: string; localTest?: string };

export function validateSupabaseConfig(url: string | undefined, key: string | undefined, policy: ConnectionPolicy = {}) {
  const localTest = policy.localTest === "true";
  if (localTest && policy.nodeEnv !== "development") throw new SupabaseConfigError();
  if (!url || !key || url !== url.trim() || key !== key.trim() || /\s/.test(key) || /your_|example|supabase_project|supabase_publishable|여기에/i.test(url + key)) throw new SupabaseConfigError();
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new SupabaseConfigError(); }
  // Compare raw URLs too: URL normalization must not admit host aliases or extra paths.
  const allowedUrl = localTest
    ? url === "http://127.0.0.1:54321" || url === "http://127.0.0.1:54321/"
    : parsed.protocol === "https:";
  if (!allowedUrl || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/" || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) throw new SupabaseConfigError();
  return { url, key };
}
export function getSupabaseConfig() {
  return validateSupabaseConfig(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    nodeEnv: process.env.NODE_ENV,
    localTest: process.env.SUPABASE_LOCAL_TEST,
  });
}
