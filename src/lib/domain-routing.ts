// Domain routing chooses the entry page only; admin authorization stays server-side.
export function isAdminRoot(host: string | null, pathname: string) {
  return pathname === "/" && host?.toLowerCase() === "admin.malmoim.com";
}
