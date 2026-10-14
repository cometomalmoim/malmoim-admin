import Link from "next/link";
export type OperationScope = { kind: "all" } | { kind: "event"; eventId: string; preview: boolean };
export function RecruitmentCards({ preview = false, base }: { preview?: boolean; base: string }) {
  if (!preview) return <div className="ops-empty"><h2>등록된 모집 페이지가 없습니다</h2><p>페이지가 등록되면 연결된 이벤트와 게시 상태를 확인할 수 있습니다.</p></div>;
  return <article className="ops-recruitment-card"><span className="ops-tag">미리보기 데이터</span><h2>모집 페이지 카드 구조</h2><p>실제 모집 페이지가 아닌 구성 확인용 안내입니다.</p><dl><div><dt>연결된 이벤트</dt><dd>미리보기 구조</dd></div><div><dt>게시 상태</dt><dd>게시되지 않음</dd></div><div><dt>공개 주소</dt><dd>없음</dd></div></dl><div className="ops-actions"><button disabled>미리보기 · 준비 중</button><button disabled>주소 복사 · 준비 중</button><Link href={`${base}/events/structure/overview`}>이벤트 구조 보기 →</Link></div></article>;
}
export function ScopedPanel({ feature, scope, preview, base }: { feature: string; scope: OperationScope; preview: boolean; base: string }) {
  const label = scope.kind === "event" ? "해당 이벤트" : "전체";
  if (feature === "recruitment") return <section className="ops-panel"><h2>{label} 모집 페이지</h2><RecruitmentCards preview={preview} base={base} /></section>;
  const names: Record<string,string> = { messages: "문자 발송 내역", certificates: "수료증 발급 내역", resources: "자료" };
  return <section className="ops-panel"><h2>{label} {names[feature] ?? "목록"}</h2><div className="ops-empty"><h3>등록된 항목이 없습니다</h3><p>운영 안내를 준비하고 있습니다.</p></div><p className="ops-muted">{feature === "messages" ? "문자 발송" : feature === "certificates" ? "템플릿 관리와 발급" : "자료 등록"} · 준비 중</p></section>;
}
