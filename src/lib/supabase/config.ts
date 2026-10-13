export class SupabaseConfigError extends Error {
  constructor() { super("Supabase 연결 설정을 확인해주세요."); this.name = "SupabaseConfigError"; }
}
export function validateSupabaseConfig(url: string | undefined, key: string | undefined) {
  if (!url || !key || url !== url.trim() || key !== key.trim() || /\s/.test(key) || /your_|example|supabase_project|supabase_publishable|여기에/i.test(url + key)) throw new SupabaseConfigError();
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new SupabaseConfigError(); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/" || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) throw new SupabaseConfigError();
  return { url, key };
}
export function getSupabaseConfig() {
  return validateSupabaseConfig(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
