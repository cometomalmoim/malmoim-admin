"use client";
import { useActionState, useEffect, useState } from "react";
import QRCode from "qrcode";
import Image from "next/image";
import { createSurveyAction, updateSurveyAction, deleteSurveyAction, type SurveyActionState } from "@/app/actions/surveys";

const initialState: SurveyActionState = { message: "", ok: false };
function Message({ state }: { state: SurveyActionState }) { return state.message ? <p className={`sv-message${state.ok ? " is-success" : ""}`} role={state.ok ? "status" : "alert"}>{state.message}</p> : null; }

export function SurveyCreateForm({ defaultOpensAt, defaultClosesAt }: { defaultOpensAt: string; defaultClosesAt: string }) {
  const [state, action, pending] = useActionState(createSurveyAction, initialState);
  return <form className="sv-create-form" action={action}>
    <h2>기수 설문 등록</h2><p className="ops-muted">기수를 등록하면 공유 URL과 QR이 만들어집니다. 시작·종료 시각은 한국시간 기준이며 기본 응답 기간은 7일입니다.</p>
    <div className="sv-create-fields"><label>기수 이름<input name="cohort_name" required maxLength={80} placeholder="예: 말모임 10기" /></label><label>공개 시작 (한국시간)<input name="opens_at" type="datetime-local" required defaultValue={defaultOpensAt} /></label><label>공개 종료 (한국시간)<input name="closes_at" type="datetime-local" required defaultValue={defaultClosesAt} /></label></div>
    <Message state={state} /><button className="sv-primary" disabled={pending}>{pending ? "등록 중…" : "기수 설문 만들기"}</button>
  </form>;
}

export function SurveySettingsForm({ id, status, opensAt, closesAt }: { id: string; status: string; opensAt: string; closesAt: string }) {
  const [state, action, pending] = useActionState(updateSurveyAction, initialState);
  return <form className="sv-settings-form" action={action}>
    <input type="hidden" name="id" value={id} />
    <label>설문 상태<select name="status" defaultValue={status}><option value="draft">준비 중</option><option value="open">공개</option><option value="closed">종료</option></select></label>
    <label>공개 시작 (한국시간)<input name="opens_at" type="datetime-local" required defaultValue={opensAt} /></label>
    <label>공개 종료 (한국시간)<input name="closes_at" type="datetime-local" required defaultValue={closesAt} /></label>
    <Message state={state} /><button className="sv-secondary" disabled={pending}>{pending ? "저장 중…" : "상태·기간 저장"}</button>
  </form>;
}

export function SurveyDeleteForm({ id, cohortName, responseCount }: { id: string; cohortName: string; responseCount: number }) {
  const [state, action, pending] = useActionState(deleteSurveyAction, initialState);
  return <form className="sv-delete-form" action={action} onSubmit={event => {
    const confirmed = window.confirm(`‘${cohortName}’ 설문과 익명 응답 ${responseCount}건을 영구 삭제할까요? 삭제한 데이터는 복구할 수 없습니다.`);
    if (!confirmed) event.preventDefault();
  }}>
    <input type="hidden" name="id" value={id} />
    <div><strong>설문 영구 삭제</strong><p>이 기수 설문과 익명 응답 {responseCount}건이 함께 삭제됩니다. 삭제 후에는 복구할 수 없습니다.</p></div>
    <Message state={state} />
    <button className="sv-danger" type="submit" disabled={pending}>{pending ? "삭제 중…" : "설문과 응답 삭제"}</button>
  </form>;
}

export function SurveyShareTools({ token, cohortName }: { token: string; cohortName: string }) {
  const [url, setUrl] = useState("");
  const [image, setImage] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const nextUrl = new URL(`/survey/${token}`, window.location.origin).toString();
    let cancelled = false;
    QRCode.toDataURL(nextUrl, { width: 320, margin: 2, errorCorrectionLevel: "M" }).then(value => { if (!cancelled) { setUrl(nextUrl); setImage(value); } }).catch(() => { if (!cancelled) { setUrl(nextUrl); setMessage("QR을 만들지 못했습니다."); } });
    return () => { cancelled = true; };
  }, [token]);
  async function copyUrl() {
    try { await navigator.clipboard.writeText(url); setMessage("설문 URL을 복사했습니다."); }
    catch { setMessage("URL 복사 권한이 없습니다. 주소를 직접 선택해 복사해주세요."); }
  }
  return <section className="sv-share" aria-label={`${cohortName} 설문 공유`}>
    <div className="sv-share-link"><label htmlFor={`sv-url-${token}`}>공유 URL</label><input id={`sv-url-${token}`} readOnly value={url || "링크 준비 중…"} /><button className="sv-secondary" type="button" disabled={!url} onClick={copyUrl}>URL 복사</button></div>
    <div className="sv-qr-area"><div><h3>현장 QR 코드</h3><p className="ops-muted">QR에는 위 설문 URL만 담기며, QR 생성 서비스에 URL을 전송하지 않습니다.</p>{message && <p role="status" className="sv-message">{message}</p>}{image && <a className="sv-secondary" href={image} download={`malmoim-${cohortName}-survey-qr.png`}>QR 이미지 저장</a>}</div>{image ? <Image className="sv-qr" src={image} alt={`${cohortName} 참가자 설문 QR 코드`} width={220} height={220} unoptimized /> : <div className="sv-qr-placeholder" role="status">QR 생성 중…</div>}</div>
  </section>;
}
