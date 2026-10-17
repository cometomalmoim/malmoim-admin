"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { ReviewCard, ReviewDetail, ReviewEditor } from "../history-reviews";
import type { Review } from "../review-types";

// UI fixtures only. Never passed to database mutations or used as authentication.
const demos: Review[] = (["regular", "special", "other"] as const).map((category, index) => ({
  id: `demo-${index}`, author_id: "demo-not-a-user", display_name: "데모 표시명",
  title: ["[데모] 짧은 제목", "[데모] 두 줄 이상의 긴 제목과 카드 정렬을 확인하는 예시입니다", "[데모] 기타 카테고리 화면 확인"][index],
  category, content: index === 0 ? "[개발용 예시] 짧은 본문입니다. 실제 참여 후기가 아닙니다." : "[개발용 예시] 카드의 본문 미리보기와 줄바꿈, 긴 문장 표시를 확인합니다. 실제 사용자 후기가 아니며 저장되지 않습니다.\n".repeat(5),
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  photos: index === 1 ? ["/brand/malmoim-logo.png"] : [], photo_paths: index === 1 ? ["demo-logo"] : [],
}));
export function ReviewPreview() {
  const [editor, setEditor] = useState<"new" | Review | null>(null);
  const [detail, setDetail] = useState<Review | null>(null);
  const [notice, setNotice] = useState("");
  const trigger = useRef<HTMLElement | null>(null);
  function remember() { trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }
  function restore() { requestAnimationFrame(() => trigger.current?.isConnected && trigger.current.focus()); }
  return <section className="history-reviews" aria-labelledby="demo-title">
    <div className="history-heading"><p className="history-label">DEVELOPMENT PREVIEW</p><h1 id="demo-title">후기 <span>UI 미리보기</span></h1></div>
    <p className="review-demo-notice">개발 환경 전용입니다. 모든 글·표시명·날짜는 UI 확인용 데모이며 사진 자리는 브랜드 로고를 사용합니다. 로그인 상태를 흉내 내지 않으며 실제 등록·수정·삭제·사진 업로드를 실행하지 않습니다.</p>
    <div className="review-toolbar review-preview-toolbar"><Link href="/history">히스토리로 돌아가기</Link><button className="review-create" type="button" onClick={() => { remember(); setDetail(null); setEditor("new"); }}>새 글 폼 미리보기</button><button className="history-more" type="button" onClick={() => { remember(); setDetail(null); setEditor(demos[1]); }}>수정 폼 미리보기</button></div>
    <p role="status" className="review-notice">{notice}</p>
    <div className="history-review-grid">{demos.map((review) => <ReviewCard key={review.id} review={review} open={() => { remember(); setNotice(""); setDetail(review); }} />)}</div>
    {editor && <ReviewEditor preview review={editor === "new" ? undefined : editor} close={() => { setEditor(null); restore(); }} saved={async () => { /* Preview never calls save. */ }} />}
    {detail && !editor && <ReviewDetail review={detail} close={() => { setDetail(null); restore(); }} edit={() => setEditor(detail)} remove={() => { setDetail(null); setNotice("개발용 삭제 확인을 마쳤습니다. 실제 삭제 요청은 보내지 않았습니다."); restore(); }} />}
  </section>;
}
