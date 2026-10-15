'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { saveEvent } from '@/app/actions/events';
import { eventLocalDate } from '@/lib/event-validation';
import type { EventRow } from '@/lib/events';
export function EventEditor({row}:{row?:EventRow}) {
  const [state,action,pending] = useActionState(saveEvent,{message:''});
  const [draft,setDraft] = useState<Record<string,string>>(()=>({
    title:row?.title??'',description:row?.description??'',image_url:row?.image_url??'',
    location:row?.location??'',capacity:row?.capacity?.toString()??'',fee_notice:row?.fee_notice??'',visual_theme:row?.visual_theme??'default',
    fee_amount_krw:row?.fee_amount_krw?.toString()??'',payment_method:row?.payment_method??'',payment_bank_name:row?.payment_bank_name??'',payment_account_number:row?.payment_account_number??'',payment_account_holder:row?.payment_account_holder??'',payment_due_at:eventLocalDate(row?.payment_due_at),payment_notice:row?.payment_notice??'',
    ...Object.fromEntries((['starts_at','ends_at','opens_at','closes_at'] as const).map(key=>[key,eventLocalDate(row?.[key])])),
  }));
  const field = (name:string)=>({value:draft[name],onChange:(event:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>setDraft(previous=>({...previous,[name]:event.target.value}))});
  return <form action={action} className="evt-form"><input type="hidden" name="id" value={row?.id ?? ''}/><fieldset disabled={pending || (!row && Boolean(state.slug))}>
    <legend>이벤트 기본 정보</legend>
    <label>제목 · 필수<input name="title" required maxLength={150} {...field('title')}/></label>
    <label>화면 스타일<select name="visual_theme" value={draft.visual_theme} onChange={event=>setDraft(previous=>({...previous,visual_theme:event.target.value}))}><option value="default">기본</option><option value="halloween">할로윈</option></select><small>이 이벤트의 목록 카드와 상세 화면에만 적용됩니다.</small></label>
    <label>소개<textarea name="description" rows={5} maxLength={5000} {...field('description')}/></label>
    <label>대표 이미지 주소<input name="image_url" type="url" maxLength={2000} placeholder="https://…" {...field('image_url')}/><small>사용 권한이 있는 이미지의 HTTPS 주소를 입력해주세요. 파일 업로드는 추후 지원합니다.</small></label>
    <p>모든 일시는 한국시간(KST) 기준입니다.</p><div className="evt-fields">
    {([['starts_at','행사 시작'],['ends_at','행사 종료'],['opens_at','모집 시작'],['closes_at','모집 마감']] as const).map(([key,label])=>{const required=key==='starts_at'||key==='ends_at';return <label key={key}>{label}{required?' · 필수':' · 선택'}<input type="datetime-local" name={key} required={required} {...field(key)}/></label>;})}
    </div><p className="ops-muted">모집 기간은 미정이면 시작·마감을 모두 비워두세요. 정보 수정에서 나중에 설정하거나 변경할 수 있습니다. 실제 접수 개시 전에는 확정해야 합니다.</p><label>장소 · 필수<input name="location" required maxLength={300} {...field('location')}/></label>
    <label>정원<input type="number" name="capacity" min={1} max={100000} step={1} {...field('capacity')}/><small>미정이면 비워두세요. 정원에 따른 신청 제한은 접수 기능에서 연결합니다.</small></label>
    <label>참가비 금액 (KRW)<input type="number" name="fee_amount_krw" min={0} max={2147483647} step={1} {...field('fee_amount_krw')}/><small>비우면 참가비 미정, 0은 무료입니다. 입력한 금액을 이 이벤트에 저장합니다.</small></label>
    <label>기존 참가비 안내 문구<textarea name="fee_notice" rows={2} maxLength={1000} {...field('fee_notice')}/><small>기존 안내 데이터는 보존하며 금액과 별도로 관리합니다.</small></label>
    <fieldset><legend>이벤트 입금 안내 (관리자 전용)</legend><div className="evt-fields"><label>입금 방법<input name="payment_method" maxLength={80} {...field('payment_method')}/></label><label>은행<input name="payment_bank_name" maxLength={100} {...field('payment_bank_name')}/></label><label>계좌번호<input name="payment_account_number" maxLength={100} {...field('payment_account_number')}/></label><label>예금주<input name="payment_account_holder" maxLength={100} {...field('payment_account_holder')}/></label><label>납부 기한<input type="datetime-local" name="payment_due_at" {...field('payment_due_at')}/></label></div><label>공지 문구<textarea name="payment_notice" rows={3} maxLength={2000} {...field('payment_notice')}/></label><small>저장된 입금 안내는 관리자 화면에서 확인할 수 있습니다.</small></fieldset>
    <p className="ops-muted">새 이벤트는 초안으로 저장됩니다. 이 화면에서는 게시·접수 상태를 변경하지 않습니다.</p>
    <button className="evt-primary" type="submit">{pending?'저장 중…':row?'변경사항 저장':'이벤트 등록'}</button>
  </fieldset><p role="status" aria-live="polite">{state.message}</p>{state.slug&&<Link className="ops-link" href={`/admin/events/${state.slug}/overview`}>저장한 이벤트 확인 →</Link>} <Link className="ops-link" href="/admin/events">이벤트 목록</Link></form>;
}
