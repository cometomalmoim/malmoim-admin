import type { PublicLocale } from "./public-content";
export const boardText = (locale: PublicLocale, ko: string, en: string) => locale === "en" ? en : ko;
export const boardCategories = [
 { value: "notice", ko: "공지사항", en: "Notices" }, { value: "free", ko: "자유게시판", en: "General" }, { value: "question", ko: "언어 질문", en: "Language questions" },
] as const;
export const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export type CommunityQuery = { q: string; category: string; scope: string; period: string; status: string; author: string; pinned: string; page: number };
export function communityQuery(raw: Record<string, string | string[] | undefined>): CommunityQuery {
 const choice = (key: string, allowed: string[], fallback: string) => typeof raw[key] === "string" && allowed.includes(raw[key] as string) ? raw[key] as string : fallback;
 const page = Number(raw.page);
 return { q: typeof raw.q === "string" ? raw.q.trim().slice(0,100) : "", category: choice("category",["all","notice","free","question"],"all"),
  scope: choice("scope",["all","title","author","comments"],"all"), period: choice("period",["all","day","week","month","quarter","year"],"all"),
  author: typeof raw.author === "string" ? raw.author.trim().slice(0,100) : "", pinned: choice("pinned",["all","pinned","unpinned"],"all"),
  status: choice("status",["all","public","hidden","deleted","reported"],"all"), page: Number.isSafeInteger(page) && page>0 ? Math.min(page,10000) : 1 };
}
export type CommunityPost = { event_id?:string|null;language?:'ko'|'en';images?:string[]; id: string; category: string; title: string; content: string; author_name: string; created_at: string; updated_at: string; view_count: number; is_pinned: boolean; status: string; can_edit: boolean; comment_count: number; report_count: number | null };
export type CommunityComment = { id: string; post_id: string; content: string; author_name: string; created_at: string; updated_at: string; status: string; can_edit: boolean };
export type CommunityReport = { id: string; post_id: string | null; comment_id: string | null; reason: string; detail: string; status: string; updated_at: string; original_content: string };
export type CommunityLog = { id: string; actor_id: string; action: string; reason: string; created_at: string };
export type CommunityList = { posts: CommunityPost[]; total: number; page: number; keywords: { word: string; count: number }[]; authenticated: boolean; admin: boolean; stats: { total: number; hidden: number; reports: number } | null };
export type CommunityDetail = { post: CommunityPost; comments: CommunityComment[]; comment_total: number; comment_page: number; authenticated: boolean; admin: boolean; reports: CommunityReport[] | null; logs: CommunityLog[] | null };
export type CommunityActionState = { message: string; success?: boolean };
export type BoardField = { name: string; label: string; value?: string; type?: "input" | "textarea" | "select"; required?: boolean; maxLength?: number; options?: { value: string; label: string }[] };
export function communityInput(action: string, form: FormData, admin: boolean) {
 const text = (key: string) => String(form.get(key) ?? "").trim();
 const bounded = (key: string, max: number) => { const value=text(key); if(!value || value.length>max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error("validation");return value; };
 if(action==="post_save") {
  const category=text("category");
  if(!(admin?["notice"]:["free","question"]).includes(category)) throw new Error("validation");
  return { category,title:bounded("title",200),content:bounded("content",20000) };
 }
 if(action==="comment_save") { const post_id=text("post_id");if(!text("id")&&!uuid(post_id))throw new Error("validation");return {content:bounded("content",2000),post_id}; }
 if(action==="report") { const target=text("target"),reason=text("reason"),detail=text("detail");if(!["post","comment"].includes(target)||!["spam","abuse","privacy","other"].includes(reason)||detail.length>1000)throw new Error("validation");return {target,reason,detail}; }
 if(["hide_post","show_post","hide_comment","show_comment","pin","report_review"].includes(action)) {
  if(!admin)throw new Error("forbidden");
  const reason=bounded("reason",500);
  if(reason.startsWith("[조치 없음]")&&!reason.slice("[조치 없음]".length).trim())throw new Error("validation");
  if(action==="report_review"&&!["reviewing","resolved"].includes(text("status")))throw new Error("validation");
  return {reason,is_pinned:text("is_pinned")==="true",status:text("status")};
 }
 if(!["post_delete","comment_delete"].includes(action))throw new Error("validation");
 return {};
}
export function boardHref(base: string, query: Partial<CommunityQuery>) {
 const params=new URLSearchParams();
 for(const [key,value]of Object.entries(query)) if(value!==""&&value!==undefined)params.set(key,String(value));
 return base+(params.size?"?"+params:"");
}

export function communitySaveError(code: string | undefined, locale: PublicLocale): string {
 const t=(ko:string,en:string)=>boardText(locale,ko,en);
 switch(code) {
  case "PGRST202": case "PGRST205":
   return t("게시판 DB가 준비되지 않아 저장하지 못했습니다. 운영자에게 문의해주세요.","Could not save. The board database is not ready. Please contact the site administrator.");
  case "42501":
   return t("저장 권한이 없습니다. 로그인 상태와 작성자 권한을 확인해주세요.","Could not save. Check your login and author permissions.");
  case "40001":
   return t("다른 변경사항이 있어 저장하지 못했습니다. 입력 내용을 복사한 뒤 최신 글을 확인해주세요.","Could not save. This content has changed. Copy your input before checking the latest version.");
  case "P0003":
   return t("요청이 너무 많아 저장하지 못했습니다. 잠시 후 다시 시도해주세요.","Could not save. Too many requests. Please try again shortly.");
  case "23505":
   return t("이미 처리된 요청일 수 있습니다. 새로고침 후 결과를 확인해주세요.","Could not save. This request may already have been processed. Refresh to check the result.");
  case "23514": case "23502": case "22P02":
   return t("입력값이 게시판 저장 규칙에 맞지 않습니다. 내용을 확인해주세요.","Could not save. Check the input against the board requirements.");
  default:
   return t("저장하지 못했습니다. 잠시 후 다시 시도해주세요. 결과가 불확실하면 목록을 먼저 확인해주세요.","Could not save. Please try again shortly. If the result is uncertain, check the list first.");
 }
}
