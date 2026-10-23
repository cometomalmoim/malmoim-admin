"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ActivityDialog } from "./activity-dialog";
import { cohorts, years, initialFields, validateFields, validatePhotoFiles, validatePhotoSelection, type Activity, type ActivityAsset } from "./activity-types";
export function ActivityForm({ activity, close, save, makeAsset, release, storageUnavailable = false, connected = false }: { connected?: boolean; storageUnavailable?: boolean; activity?: Activity; close: () => void; save: (activity: Activity) => void; makeAsset: (file: File) => ActivityAsset; release: (assets: ActivityAsset[]) => void }) {
  const [fields, setFields] = useState(() => connected ? { ...initialFields(activity), category: "special" as const } : initialFields(activity));
  const [cover, setCover] = useState<ActivityAsset | null>(activity?.cover ?? null);
  const [additional, setAdditional] = useState<ActivityAsset[]>(activity?.additional ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fileError, setFileError] = useState("");
  const [busy, setBusy] = useState(false);
  const [discard, setDiscard] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const newlyMade = useRef<ActivityAsset[]>([]);
  const mounted = useRef(true);
  const priorFocus = useRef<HTMLElement | null>(null);
  const dirty = JSON.stringify(fields) !== JSON.stringify(initialFields(activity)) || cover?.id !== activity?.cover.id || additional.map((p) => p.id).join() !== (activity?.additional ?? []).map((p) => p.id).join();
  useEffect(() => { const created = newlyMade.current; mounted.current = true; return () => { mounted.current = false; release(created); }; }, [release]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => { if (discard) keep.current?.focus(); }, [discard]);
  function requestClose() {
    if (busy) return;
    if (!dirty) { close(); return; }
    priorFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDiscard(true);
  }
  function resume() { setDiscard(false); requestAnimationFrame(() => { if (priorFocus.current?.isConnected) priorFocus.current.focus(); else form.current?.querySelector<HTMLElement>("select")?.focus(); }); }
  function fieldError(name: string) { return errors[name] ? <p className="activity-error" id={`activity-${name}-error`}>{errors[name]}</p> : null; }
  function assetCard(asset: ActivityAsset, remove: () => void, label: string) { return <figure className="activity-asset" key={asset.id}><Image unoptimized src={asset.url} alt={asset.alt} width={240} height={160} /><figcaption>{asset.name}</figcaption><button type="button" onClick={remove} aria-label={`${label} 첨부 취소`}>첨부 취소</button></figure>; }
  async function addPhotos(files: File[], isCover: boolean) {
    if (!files.length || busy) return;
    setFileError("");
    const nextCount = additional.length + (isCover ? 1 : files.length + 1);
    const size = additional.reduce((n, p) => n + p.size, 0) + (isCover ? 0 : (cover?.size ?? 0)) + files.reduce((n, f) => n + f.size, 0);
    if (isCover && files.length !== 1) { setFileError("대표 사진은 1장만 선택해주세요."); return; }
    const selectionError = validatePhotoSelection(nextCount, size);
    if (selectionError) { setFileError(selectionError); return; }
    setBusy(true);
    try {
      const error = await validatePhotoFiles(files);
      if (!mounted.current) return;
      if (error) { setFileError(error); return; }
      const assets = files.map(makeAsset); newlyMade.current.push(...assets);
      if (isCover) { if (cover) release([cover]); setCover(assets[0]); }
      else setAdditional([...additional, ...assets]);
      if (isCover) setErrors((old) => ({ ...old, cover: "" }));
    } catch { if (mounted.current) setFileError("사진을 확인하지 못했어요. 파일을 다시 선택해주세요."); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <ActivityDialog title={connected ? "활동 사진 등록" : storageUnavailable ? "활동 사진 입력 미리보기" : activity ? "활동 수정 UI 미리보기" : "활동 등록 UI 미리보기"} close={discard ? resume : requestClose} busy={busy}>
    {discard && <section className="activity-confirm" aria-labelledby="activity-discard"><h3 id="activity-discard">작성 중인 내용을 버릴까요?</h3><p>아직 목록에 반영하지 않은 내용과 첨부 사진이 사라집니다.</p><div className="activity-actions"><button className="activity-primary" ref={keep} type="button" onClick={resume}>계속 작성하기</button><button type="button" onClick={close}>버리고 닫기</button></div></section>}
    <form ref={form} hidden={discard} noValidate aria-busy={busy} onSubmit={(e) => {
      e.preventDefault(); if (storageUnavailable || busy) return;
      const next = validateFields(fields); if (!cover) next.cover = "대표 사진 1장을 첨부해주세요.";
      setErrors(next);
      if (Object.keys(next).length) { requestAnimationFrame(() => form.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus()); return; }
      if (!cover || !fields.category) return;
      const base = { id: activity?.id ?? crypto.randomUUID(), title: fields.title.trim(), date: fields.date, description: fields.description.trim(), cover, additional };
      save(fields.category === "regular" ? { ...base, category: "regular", cohort: Number(fields.cohort) } : { ...base, category: "special", year: Number(fields.year) });
    }}>
      <p className="activity-notice" id="activity-storage-status">{storageUnavailable ? "운영 연결 준비 중입니다. 입력과 사진 선택은 이 화면의 미리보기이며 서버로 전송하거나 저장하지 않습니다." : connected ? "사진은 허가된 Storage에 직접 업로드하며 서버 검증·확정 후 저장합니다. 실패 시 결과 확인 전 재전송하지 마세요." : "개발용 UI입니다. 아래 반영은 이 탭의 임시 목록만 바꿉니다. 실제 저장·업로드는 하지 않습니다."}</p>
      <fieldset disabled={busy}>
        <div className="activity-form-grid"><div><label htmlFor="activity-category">카테고리 <small>필수</small></label><select id="activity-category" required value={fields.category} aria-invalid={!!errors.category} aria-describedby={errors.category ? "activity-category-error" : undefined} onChange={(e) => { setFields({ ...fields, category: e.target.value as typeof fields.category, cohort: "", year: "" }); setErrors({}); }}><option value="">선택해주세요</option><option value="regular" disabled={connected}>정규 세션{connected ? " · 연결 준비 중" : ""}</option><option value="special">특별 활동</option></select>{fieldError("category")}</div>
        {fields.category === "regular" && <div><label htmlFor="activity-cohort">기수 <small>필수</small></label><select id="activity-cohort" required value={fields.cohort} aria-invalid={!!errors.cohort} aria-describedby={errors.cohort ? "activity-cohort-error" : undefined} onChange={(e) => setFields({ ...fields, cohort: e.target.value })}><option value="">기수 선택</option>{cohorts.map((n) => <option key={n} value={n}>{n}기</option>)}</select>{fieldError("cohort")}</div>}
        {fields.category === "special" && <div><label htmlFor="activity-year">연도 <small>필수</small></label><select id="activity-year" required value={fields.year} aria-invalid={!!errors.year} aria-describedby={errors.year ? "activity-year-error" : undefined} onChange={(e) => setFields({ ...fields, year: e.target.value })}><option value="">연도 선택</option>{years.map((n) => <option key={n} value={n}>{n}</option>)}</select>{fieldError("year")}</div>}</div>
        <label htmlFor="activity-title">활동 제목 <small>필수</small></label><input id="activity-title" required maxLength={120} value={fields.title} aria-invalid={!!errors.title} aria-describedby={`activity-title-count${errors.title ? " activity-title-error" : ""}`} onChange={(e) => setFields({ ...fields, title: e.target.value })} />{fieldError("title")}<p id="activity-title-count" className="activity-count">{fields.title.length} / 120자</p>
        <label htmlFor="activity-date">활동 날짜 <small>필수</small></label><input id="activity-date" type="date" required value={fields.date} min={fields.category === "special" && fields.year ? `${fields.year}-01-01` : undefined} max={fields.category === "special" && fields.year ? `${fields.year}-12-31` : undefined} aria-invalid={!!errors.date} aria-describedby={errors.date ? "activity-date-error" : undefined} onChange={(e) => setFields({ ...fields, date: e.target.value })} />{fieldError("date")}
        <label htmlFor="activity-description">활동 설명 <small>필수</small></label><textarea id="activity-description" required rows={5} maxLength={2000} value={fields.description} aria-invalid={!!errors.description} aria-describedby={`activity-description-count${errors.description ? " activity-description-error" : ""}`} onChange={(e) => setFields({ ...fields, description: e.target.value })} />{fieldError("description")}<p id="activity-description-count" className="activity-count">{fields.description.length.toLocaleString()} / 2,000자</p>
        <p id="activity-photo-policy" className="activity-policy">JPG·PNG·WebP, 장당 4.5MB, 대표 포함 최대 10장·합계 45MB. 대표 사진 1장은 필수입니다.</p>
        <label htmlFor="activity-cover">대표 사진 <small>필수 · 1장</small></label><input id="activity-cover" type="file" accept="image/jpeg,image/png,image/webp" aria-invalid={!!errors.cover} aria-describedby={`activity-photo-policy${errors.cover ? " activity-cover-error" : ""}`} onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; void addPhotos(files, true); }} />{fieldError("cover")}
        {cover && <div className="activity-attachments">{assetCard(cover, () => { release([cover]); setCover(null); }, "대표 사진")}</div>}
        <label htmlFor="activity-additional">추가 사진 <small>선택</small></label><input id="activity-additional" type="file" multiple accept="image/jpeg,image/png,image/webp" aria-describedby="activity-photo-policy" onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; void addPhotos(files, false); }} />
        {!!additional.length && <div className="activity-attachments">{additional.map((asset, i) => assetCard(asset, () => { release([asset]); setAdditional(additional.filter((p) => p.id !== asset.id)); }, `추가 사진 ${i + 1}`))}</div>}
        <p className="activity-count">사진 {(cover ? 1 : 0) + additional.length} / 10장</p>
        <div className="activity-actions"><button type="submit" className="activity-primary" disabled={storageUnavailable} aria-describedby={storageUnavailable ? "activity-storage-status" : undefined}>{storageUnavailable ? "활동 저장 · 준비 중" : connected ? "활동·사진 저장" : activity ? "데모 수정 반영" : "데모 목록에 추가"}</button><button type="button" onClick={requestClose}>취소</button></div>
      </fieldset>
      <p role="status">{busy ? "사진 형식과 내용을 확인하고 있어요…" : ""}</p>
      {(Object.values(errors).some(Boolean) || fileError) && <p role="alert" className="activity-error">{fileError || "필수 입력 항목을 확인해주세요. 아직 목록에 반영하지 않았습니다."}</p>}
    </form>
  </ActivityDialog>;
}
