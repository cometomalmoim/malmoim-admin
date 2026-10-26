"use client";
import {Localized} from "@/components/public-translation";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { deleteReview, loadReviews, loadReviewAccess, saveReview } from "./review-actions";
import { reviewApprovalNotice, reviewApprovalError, type ReviewPermission, MAX_PHOTOS, ORIGINAL_PHOTO_LIMIT, reviewCategories, reviewDate, type Review, type ReviewFilter, type ReviewPage } from "./review-types";
import { prepareReviewPhoto } from "./review-photo-client";

export function ReviewDialog({ title, children, close, busy = false, editor = false, userTitle = false }: { userTitle?: boolean; title: string; children: ReactNode; close: () => void; busy?: boolean; editor?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node?.showModal();
    return () => { node?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <Localized>{<dialog ref={dialog} className={`review-dialog${editor ? " review-editor-dialog" : ""}`} aria-labelledby="review-dialog-title" tabIndex={-1} onKeyDown={(event) => {
    if (event.key !== "Tab") return;
    const node = dialog.current;
    if (!node) return;
    const controls = Array.from(node.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]"))
      .filter((element) => !element.matches(":disabled") && element.tabIndex >= 0 && element.getClientRects().length > 0 && !element.closest("[hidden]"));
    const first = controls[0]; const last = controls.at(-1);
    if (!first || !last) { event.preventDefault(); node.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === node)) { event.preventDefault(); first.focus(); }
  }} onCancel={(event) => { event.preventDefault(); if (!busy) close(); }}>
    <div className="review-dialog-heading"><h3 id="review-dialog-title" data-i18n-skip={userTitle}>{title}</h3><button type="button" disabled={busy} onClick={close} aria-label="후기 창 닫기">닫기</button></div>{children}
  </dialog>}</Localized>;
}
function ReviewPhotos({ review }: { review: Review }) {
  return <Localized>{<div className="review-photos">{review.photos.map((url, index) => url ? <Image unoptimized key={review.photo_paths[index]} src={url} alt={`${review.title} 첨부 사진 ${index + 1}`} width={900} height={650} /> : null)}
    {review.photos.some((url) => !url) && <p className="review-notice">일부 사진을 불러오지 못했어요. 후기 내용은 확인할 수 있습니다.</p>}
  </div>}</Localized>;
}
function PhotoPreview({ file }: { file: File }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (image.current) image.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <Localized>{<Image ref={image} unoptimized src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt={`첨부 예정: ${file.name}`} width={180} height={120} />}</Localized>;
}

export function ReviewEditor({ review, close, saved, preview = false }: { review?: Review; close: () => void; saved: (message: string) => Promise<void>; preview?: boolean }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [processingPhotos, setProcessingPhotos] = useState(false);
  const processing = useRef(false);
  const photoTask = useRef(0);
  const [title, setTitle] = useState(review?.title ?? "");
  const [content, setContent] = useState(review?.content ?? "");
  const [category, setCategory] = useState(review?.category ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [discard, setDiscard] = useState(false);
  const keepEditing = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const keptCount = (review?.photo_paths.length ?? 0) - removed.length;
  const dirty = processingPhotos || title !== (review?.title ?? "") || content !== (review?.content ?? "") || category !== (review?.category ?? "") || files.length > 0 || removed.length > 0;
  useEffect(() => () => { photoTask.current += 1; }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => { if (discard) keepEditing.current?.focus(); }, [discard]);
  function requestClose() {
    if (busy || processing.current) return;
    if (!dirty) { close(); return; }
    lastFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDiscard(true);
  }
  function resume() {
    setDiscard(false);
    requestAnimationFrame(() => { if (lastFocus.current?.isConnected && !lastFocus.current.closest("[hidden]")) lastFocus.current.focus(); else formRef.current?.querySelector<HTMLInputElement>("#review-title")?.focus(); });
  }
  return <Localized>{<ReviewDialog editor title={review ? "참여 후기 수정" : "참여 후기 등록"} close={discard ? resume : requestClose} busy={busy || processingPhotos}>
    {discard && <div className="review-confirm" role="group" aria-labelledby="review-discard-title">
      <h4 id="review-discard-title">작성 중인 내용을 버릴까요?</h4><p>아직 저장하지 않은 내용과 선택한 사진이 사라집니다.</p>
      <div className="review-actions"><button type="button" className="review-create" ref={keepEditing} onClick={resume}>계속 작성하기</button><button type="button" className="review-danger" onClick={close}>내용 버리고 닫기</button></div>
    </div>}
    <form ref={formRef} hidden={discard} aria-busy={busy || processingPhotos} onSubmit={(event) => {
      event.preventDefault();
      if (processing.current || busy) return;
      if (!title.trim() || !content.trim()) { setError("제목과 내용을 공백만으로 입력할 수 없습니다."); (!title.trim() ? formRef.current?.querySelector<HTMLInputElement>("#review-title") : formRef.current?.querySelector<HTMLTextAreaElement>("#review-content"))?.focus(); return; }
      if (keptCount + files.length > MAX_PHOTOS) { setPhotoError("기존 사진을 포함해 최대 3장까지 첨부할 수 있어요."); return; }
      if (preview) { setError("개발용 미리보기입니다. 입력을 확인했으며 실제 저장 요청은 보내지 않았습니다."); return; }
      const form = new FormData(event.currentTarget);
      form.delete("photos"); files.forEach((file) => form.append("photos", file));
      removed.forEach((path) => form.append("removePhoto", path));
      start(async () => {
        setError("");
        try { const result = await saveReview(form); if (result.ok) await saved(result.message); else setError(result.message); }
        catch { setError("저장 결과를 확인하지 못했어요. 입력 내용은 유지됩니다. 목록에서 등록 여부를 확인한 뒤 다시 시도해주세요."); }
      });
    }}>
      <p className="review-form-intro">제목·카테고리·내용을 입력해주세요.</p>
      {preview && <p className="review-demo-notice">개발용 미리보기 · 실제 등록·수정·업로드가 실행되지 않습니다.</p>}
      <fieldset disabled={busy || processingPhotos}>
        {review && <input type="hidden" name="id" value={review.id} />}
        <label htmlFor="review-title">제목 <span className="review-required">필수</span></label><input id="review-title" name="title" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} aria-describedby="review-title-count" placeholder="어떤 경험을 하셨나요?" />
        <p id="review-title-count" className="review-count">{title.length.toLocaleString()} / 120자</p>
        <label htmlFor="review-category">카테고리 <span className="review-required">필수</span></label><select id="review-category" name="category" required value={category} onChange={(e) => setCategory(e.target.value)}><option value="" disabled>카테고리를 선택해주세요</option>{Object.entries(reviewCategories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <label htmlFor="review-content">내용 <span className="review-required">필수</span></label><textarea id="review-content" name="content" required maxLength={10000} rows={5} value={content} onChange={(e) => setContent(e.target.value)} aria-describedby="review-content-count" placeholder="기억에 남는 순간이나 느낀 점을 자유롭게 적어주세요." />
        <p id="review-content-count" className="review-count">{content.length.toLocaleString()} / 10,000자</p>
        <label htmlFor="review-photos">사진 첨부 <span className="review-optional">선택 · {keptCount + files.length} / 3장</span></label><p id="review-photo-help">최대 3장(기존 사진 포함) · JPG·PNG·WebP · 원본 장당 5MB 이하. 긴 변 최대 1600px·장당 1MB 이하로 자동 처리합니다. 후기와 사진은 공개됩니다.</p>
        {!!review?.photos.length && <div className="review-attachments">{review.photos.map((url, index) => {
          const path = review.photo_paths[index]; const isRemoved = removed.includes(path);
          return <div className={`review-attachment${isRemoved ? " is-removed" : ""}`} key={path}>{url ? <Image unoptimized src={url} alt={`기존 첨부 사진 ${index + 1}`} width={180} height={120} /> : <p>사진을 불러오지 못했어요.</p>}<p>기존 사진 {index + 1}{isRemoved ? " · 삭제 예정" : ""}</p><button type="button" aria-label={`기존 사진 ${index + 1} ${isRemoved ? "유지" : "삭제"}`} aria-pressed={isRemoved} onClick={() => { if (isRemoved && keptCount + files.length >= MAX_PHOTOS) { setPhotoError("새로 선택한 사진을 취소한 뒤 기존 사진을 복원해주세요."); return; } setRemoved(isRemoved ? removed.filter((p) => p !== path) : [...removed, path]); setPhotoError(""); }}>{isRemoved ? "사진 유지하기" : "사진 삭제"}</button></div>;
        })}</div>}
        <input id="review-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple aria-describedby={`review-photo-help${photoError ? " review-photo-error" : ""}`} aria-invalid={!!photoError} onChange={async (event) => {
          const added = Array.from(event.target.files ?? []); event.target.value = "";
          if (!added.length || processing.current || busy) return;
          if (added.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) { setPhotoError("JPG, PNG, WebP 사진만 선택할 수 있어요."); return; }
          if (added.some((file) => !file.size || file.size > ORIGINAL_PHOTO_LIMIT)) { setPhotoError("원본 사진은 장당 5MB 이하로 선택해주세요. 빈 파일은 첨부할 수 없어요."); return; }
          if (keptCount + files.length + added.length > MAX_PHOTOS) { setPhotoError("사진은 기존 사진을 포함해 최대 3장까지 첨부할 수 있어요."); return; }
          const task = ++photoTask.current;
          processing.current = true; setProcessingPhotos(true); setPhotoError("");
          try {
            const prepared: File[] = [];
            // Decode one photo at a time to limit peak memory use on phones.
            for (const file of added) prepared.push(await prepareReviewPhoto(file));
            if (photoTask.current === task) setFiles((current) => [...current, ...prepared]);
          } catch (error) {
            if (photoTask.current === task) setPhotoError(error instanceof Error ? error.message : "사진을 처리하지 못했어요. 다른 사진을 선택해주세요.");
          } finally {
            processing.current = false;
            if (photoTask.current === task) setProcessingPhotos(false);
          }
        }} />
        {photoError && <p id="review-photo-error" role="alert" className="review-error">{photoError}</p>}
        {!!files.length && <div className="review-attachments">{files.map((file, index) => <div className="review-attachment" key={`${index}-${file.name}-${file.lastModified}`}><PhotoPreview file={file} /><p>{file.name}</p><small>{Math.ceil(file.size / 1024)}KB · 첨부 예정</small><button type="button" aria-label={`${file.name} 첨부 취소`} onClick={() => { setFiles(files.filter((_, i) => i !== index)); setPhotoError(""); }}>첨부 취소</button></div>)}</div>}
        <div className="review-actions"><button type="submit" className="review-create">{busy ? "저장 중…" : review ? "수정 저장" : "후기 등록"}</button><button type="button" onClick={requestClose}>취소</button></div>
      </fieldset>
      <p role="status" className="review-notice">{processingPhotos ? "사진 크기와 용량을 조정하고 있어요. 잠시만 기다려주세요." : busy ? "후기를 저장하고 있어요. 잠시만 기다려주세요." : ""}</p>
      {error && <p role="alert" className="review-error">{error}</p>}
    </form>
  </ReviewDialog>}</Localized>;
}

export function ReviewCard({ review, open }: { review: Review; open: () => void }) {
  const cover = review.photos.find((url) => !!url);
  return <Localized>{<article className="history-review-card"><button type="button" className="review-card-open" onClick={open} aria-label={`${review.title} 후기 상세 보기`}>
    <div className="review-card-body"><span className="review-category">{reviewCategories[review.category]}</span><h3 data-i18n-skip>{review.title}</h3><p className="review-preview" data-i18n-skip>{review.content}</p></div>
    {cover && <Image unoptimized className="review-card-photo" src={cover} alt={`${review.title} 대표 사진`} width={600} height={360} />}
    <span className="review-byline"><span data-i18n-skip={!!review.display_name?.trim() && review.display_name.trim() !== "익명"}>{review.display_name?.trim() || "익명"}</span><time dateTime={review.created_at}>{reviewDate(review.created_at)}</time></span><span className="review-card-more">더 보기 <span aria-hidden="true">↗</span></span>
  </button></article>}</Localized>;
}

export function ReviewDetail({ review, close, edit, remove, busy = false, error = "" }: { review: Review; close: () => void; edit?: () => void; remove?: () => void; busy?: boolean; error?: string }) {
  const [confirm, setConfirm] = useState(false);
  const cancelDelete = useRef<HTMLButtonElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (confirm) cancelDelete.current?.focus(); }, [confirm]);
  return <Localized>{<ReviewDialog userTitle title={review.title} close={() => { if (confirm) { setConfirm(false); requestAnimationFrame(() => deleteButton.current?.focus()); } else close(); }} busy={busy}>
    {confirm ? <div className="review-confirm" role="group" aria-labelledby="review-delete-title"><h4 id="review-delete-title">이 후기를 삭제할까요?</h4><p>삭제한 후기와 사진은 복구할 수 없어요. 계속하려면 삭제 확인을 눌러주세요.</p><div className="review-actions"><button ref={cancelDelete} type="button" disabled={busy} onClick={() => { setConfirm(false); requestAnimationFrame(() => deleteButton.current?.focus()); }}>취소</button><button type="button" className="review-danger" disabled={busy} onClick={remove}>{busy ? "삭제 중…" : "삭제 확인"}</button></div></div> : <>
      <p className="review-detail-meta"><span className="review-category">{reviewCategories[review.category]}</span><span data-i18n-skip={!!review.display_name?.trim() && review.display_name.trim() !== "익명"}>{review.display_name?.trim() || "익명"}</span><time dateTime={review.created_at}>{reviewDate(review.created_at)}</time></p><p className="review-full-content" data-i18n-skip>{review.content}</p><ReviewPhotos review={review} />
      {edit && remove && <div className="review-actions"><button type="button" onClick={edit}>수정</button><button ref={deleteButton} type="button" className="review-danger" onClick={() => setConfirm(true)}>삭제</button></div>}
    </>}
    {error && <p role="alert" className="review-error">{error}</p>}
  </ReviewDialog>}</Localized>;
}
export function HistoryReviews({ initial, userId, permission }: { initial: ReviewPage; userId: string | null; permission: ReviewPermission }) {
  const [access, setAccess] = useState({ userId, permission });
  const [checking, check] = useTransition();
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);
  function requestNewReview() {
    setPermissionNotice(null);
    setLogin(false);
    setMessage("");
    check(async () => {
      try {
        const next = await loadReviewAccess();
        setAccess(next);
        if (next.permission === "approved") setEditor("new");
        else if (next.permission === "anonymous") setLogin(true);
        else setPermissionNotice(next.permission === "unapproved" ? reviewApprovalNotice : reviewApprovalError);
      } catch {
        setAccess((current) => ({ ...current, permission: "error" }));
        setPermissionNotice(reviewApprovalError);
      }
    });
  }
  const cardTrigger = useRef<HTMLElement | null>(null);
  const [page, setPage] = useState(initial);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [selected, setSelected] = useState<Review | null>(null);
  const [editor, setEditor] = useState<Review | "new" | null>(null);
  const [login, setLogin] = useState(false);
  const [message, setMessage] = useState("");
  const [detailError, setDetailError] = useState("");
  const [busy, start] = useTransition();
  const [serverAccess, setServerAccess] = useState({ userId, permission });
  // Reconcile only when server authentication props change; local RPC results remain usable.
  if (serverAccess.userId !== userId || serverAccess.permission !== permission) {
    setServerAccess({ userId, permission });
    setAccess({ userId, permission });
    setLogin(false);
    setPermissionNotice(null);
  }
  async function reload(notice: string) {
    setEditor(null); setSelected(null); setMessage(notice);
    try { setPage(await loadReviews(filter, 0)); }
    catch { setPage({ reviews: [], more: false, error: "목록을 갱신하지 못했습니다. 다시 불러오기를 눌러주세요." }); }
  }
  function fetchPage(next: ReviewFilter, append = false) {
    start(async () => {
      try {
        const result = await loadReviews(next, append ? page.reviews.length : 0);
        if (result.error && append) setMessage(result.error);
        else { setFilter(next); setPage(append ? { ...result, reviews: [...page.reviews, ...result.reviews] } : result); }
      } catch { setMessage("목록을 불러오지 못했습니다. 다시 시도해주세요."); }
    });
  }
  return <Localized>{<>
    <div className="review-toolbar"><div className="history-filters" role="group" aria-label="후기 카테고리 필터">{(["all", "regular", "special", "other"] as const).map((key) => <button type="button" key={key} aria-pressed={filter === key} disabled={busy} onClick={() => { setMessage(""); fetchPage(key); }}>{key === "all" ? "전체" : reviewCategories[key]}</button>)}</div><button className="review-create" type="button" disabled={checking} onClick={requestNewReview}>{checking ? "작성 권한 확인 중…" : access.permission === "error" ? "작성 권한 다시 확인" : "후기 등록하기"}</button></div>
    {(access.permission === "unapproved" || access.permission === "error") && <p className="review-notice" role="status">{access.permission === "unapproved" ? reviewApprovalNotice : reviewApprovalError}</p>}
    {process.env.NODE_ENV === "development" && <p className="review-demo-notice"><Link href="/history/preview">후기 UI 개발용 미리보기</Link> · 실제 데이터 저장 없이 폼과 카드를 확인합니다.</p>}
    <p className="review-notice" role="status">{busy ? "요청을 처리하고 있어요. 잠시만 기다려주세요." : message}</p>
    <div aria-busy={busy}>
      {page.error ? <div className="history-empty" role="alert"><h3>후기를 잠시 불러올 수 없어요.</h3><p>{page.error}</p><button type="button" disabled={busy} onClick={() => fetchPage(filter)}>다시 불러오기</button></div> : page.reviews.length === 0 ? <div className="history-empty"><h3>{filter === "all" ? "아직 등록된 참여 후기가 없습니다." : "이 카테고리에 등록된 후기가 없습니다."}</h3><p>말모임에서 함께한 경험을 첫 후기로 남겨주세요.</p></div> : <>
        <p className="history-result-count">후기 {page.reviews.length}개 표시</p><div className="history-review-grid">{page.reviews.map((review) => <ReviewCard review={review} key={review.id} open={() => { cardTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setSelected(review); setDetailError(""); }} />)}</div>
      </>}
      {page.more && <button className="history-more" type="button" disabled={busy} onClick={() => fetchPage(filter, true)}>더 많은 후기 보기 <span aria-hidden="true">＋</span></button>}
    </div>
    {permissionNotice && <ReviewDialog title="후기 작성 권한 안내" close={() => setPermissionNotice(null)}><p role="alert">{permissionNotice}</p><div className="review-actions"><button type="button" onClick={() => setPermissionNotice(null)}>확인</button></div></ReviewDialog>}
    {login && <ReviewDialog title="로그인이 필요합니다" close={() => setLogin(false)}><p>후기를 작성하려면 로그인이 필요합니다. 로그인 후 후기 페이지로 돌아와 작성할 수 있습니다.</p><div className="review-actions"><Link className="review-create" href="/auth/login?returnTo=history" onClick={() => setLogin(false)}>로그인하기</Link><button type="button" onClick={() => setLogin(false)}>취소</button></div></ReviewDialog>}
    {editor && (editor !== "new" || access.permission === "approved") && <ReviewEditor review={editor === "new" ? undefined : editor} close={() => setEditor(null)} saved={reload} />}
    {selected && !editor && <ReviewDetail review={selected} close={() => { setSelected(null); requestAnimationFrame(() => cardTrigger.current?.isConnected && cardTrigger.current.focus()); }} busy={busy} error={detailError}
      edit={access.userId === selected.author_id ? () => setEditor(selected) : undefined}
      remove={access.userId === selected.author_id ? () => start(async () => {
        setDetailError("");
        try { const result = await deleteReview(selected.id); if (result.ok) await reload(result.message); else setDetailError(result.message); }
        catch { setDetailError("삭제 결과를 확인하지 못했어요. 목록에서 삭제 여부를 확인한 뒤 다시 시도해주세요."); }
      }) : undefined} />}
  </>}</Localized>;
}
