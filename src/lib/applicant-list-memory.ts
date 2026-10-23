const allowed = new Set(['page','preferred_class','nationality_group','archived','korean','english','q','status','payment','nationality','year','event','utm_source','utm_medium']);
export function safeApplicantListHref(value: string | null, allOnly = false): string | null {
 if (!value || value.length > 4000 || !value.startsWith('/admin/') || /[\\\r\n]/.test(value)) return null;
 try {
  const url = new URL(value, 'https://admin.invalid');
  if (url.origin !== 'https://admin.invalid' || url.hash) return null;
  const all = url.pathname === '/admin/recruitment';
  if (!all && (allOnly || !/^\/admin\/events\/[a-zA-Z0-9_-]+\/applicants$/.test(url.pathname))) return null;
  const params = new URLSearchParams();
  for (const [key, item] of url.searchParams) if (allowed.has(key) && item) params.set(key, item.slice(0, 200));
  return url.pathname + (params.size ? '?' + params.toString() : '');
 } catch { return null; }
}
