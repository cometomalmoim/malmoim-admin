import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getEvent } from '@/lib/events';
import { AdminShell } from './admin-shell';
import { EventEditor } from './event-editor';
import './events.css';
export async function EventView({email,slug,edit=false}:{email:string;slug?:string;edit?:boolean}) {
  const result = slug ? await getEvent(slug) : null;
  if (result?.kind === 'missing') notFound();
  const row = result?.kind === 'ready' ? result.row : undefined;
  const title = !slug?'이벤트 등록':edit?'이벤트 수정':row?.title ?? '이벤트 정보';
  const format = (value:string|null)=>value?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'미설정';
  return <AdminShell email={email} current="events" title={title}><nav className="ops-breadcrumb" aria-label="페이지 이동 경로"><Link href="/admin/events">이벤트 관리</Link><span>/</span><span>{title}</span></nav><div className="ops-heading"><h1>{title}</h1></div>
    {result?.kind === 'error'?<section className="ops-panel" role="alert"><h2>이벤트를 불러오지 못했습니다</h2><p>이벤트 설정 SQL 적용 여부와 조회 권한을 확인해주세요.</p><Link href="/admin/events">목록으로</Link></section>:!slug||edit?<section className="ops-panel"><EventEditor row={row}/></section>:row&&<>
    <nav className="ops-tabs" aria-label="이벤트 관리"><Link href={`/admin/events/${row.slug}/overview`} aria-current="page">개요</Link><Link href={`/admin/events/${row.slug}/edit`}>정보 수정</Link><Link href={`/admin/events/${row.slug}/applicants`}>신청자</Link><Link href={`/admin/events/${row.slug}/resources`}>자료</Link></nav>
    <section className="ops-panel evt-detail"><h2>이벤트 정보</h2><p>모집 상태: {({draft:'초안',published:'게시',closed:'마감'} as Record<string,string>)[row.status] ?? row.status} · 실제 접수: {row.applications_open?'접수 허용 설정':'비활성'}</p><p>{row.description||'소개 미입력'}</p>
    {row.image_url&&<p><a className="ops-link" href={row.image_url} target="_blank" rel="noopener noreferrer">대표 이미지 확인 ↗</a></p>}
    <dl><dt>행사 일시 (KST)</dt><dd>{format(row.starts_at)} ~ {format(row.ends_at)}</dd><dt>장소</dt><dd>{row.location||'미설정'}</dd><dt>정원</dt><dd>{row.capacity===null?'미정':`${row.capacity}명`}</dd><dt>참가비 안내</dt><dd>{row.fee_notice||'미입력'}</dd><dt>모집 기간 (KST)</dt><dd>{format(row.opens_at)} ~ {format(row.closes_at)}</dd></dl><p className="ops-muted">모집 페이지 제작·게시와 회차별 일정 관리는 다음 단계에서 연결합니다.</p></section></>}
  </AdminShell>;
}
