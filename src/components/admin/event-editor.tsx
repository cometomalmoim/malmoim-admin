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
    location:row?.location??'',capacity:row?.capacity?.toString()??'',fee_notice:row?.fee_notice??'',
    ...Object.fromEntries((['starts_at','ends_at','opens_at','closes_at'] as const).map(key=>[key,eventLocalDate(row?.[key])])),
  }));
  const field = (name:string)=>({value:draft[name],onChange:(event:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>setDraft(previous=>({...previous,[name]:event.target.value}))});
  return <form action={action} className="evt-form"><input type="hidden" name="id" value={row?.id ?? ''}/><fieldset disabled={pending || Boolean(state.slug)}>
    <legend>이벤트 기본 정보</legend>
    <label>제목 · 필수<input name="title" required maxLength={150} {...field('title')}/></label>
    <label>소개<textarea name="description" rows={5} maxLength={5000} {...field('description')}/></label>
    <label>대표 이미지 주소<input name="image_url" type="url" maxLength={2000} placeholder="https://…" {...field('image_url')}/><small>사용 권한이 있는 이미지의 HTTPS 주소를 입력해주세요. 파일 업로드는 추후 지원합니다.</small></label>
    <p>모든 일시는 한국시간(KST) 기준입니다.</p><div className="evt-fields">
    {([['starts_at','행사 시작'],['ends_at','행사 종료'],['opens_at','모집 시작'],['closes_at','모집 마감']] as const).map(([key,label])=><label key={key}>{label} · 필수<input type="datetime-local" name={key} required {...field(key)}/></label>)}
    </div><label>장소 · 필수<input name="location" required maxLength={300} {...field('location')}/></label>
    <label>정원<input type="number" name="capacity" min={1} max={100000} step={1} {...field('capacity')}/><small>미정이면 비워두세요. 정원에 따른 신청 제한은 접수 기능에서 연결합니다.</small></label>
    <label>참가비 안내<textarea name="fee_notice" rows={3} maxLength={1000} placeholder="무료 / 30,000원 / 추후 안내 등" {...field('fee_notice')}/></label>
    <p className="ops-muted">새 이벤트는 초안으로 저장됩니다. 이 화면에서는 게시·접수 상태를 변경하지 않습니다.</p>
    <button className="evt-primary" type="submit">{pending?'저장 중…':row?'변경사항 저장':'이벤트 등록'}</button>
  </fieldset><p role="status" aria-live="polite">{state.message}</p>{state.slug&&<Link className="ops-link" href={`/admin/events/${state.slug}/overview`}>저장한 이벤트 확인 →</Link>} <Link className="ops-link" href="/admin/events">이벤트 목록</Link></form>;
}
