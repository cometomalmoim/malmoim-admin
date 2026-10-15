import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getEvent } from '@/lib/events';
import { AdminShell } from './admin-shell';
import { EventEditor } from './event-editor';
import { EventOverview } from './event-overview';
import { EventInformation } from './event-information';
import './events.css';
export async function EventView({email,slug,edit=false,information=false}:{email:string;slug?:string;edit?:boolean;information?:boolean}) {
  const result = slug ? await getEvent(slug) : null;
  if (result?.kind === 'missing') notFound();
  const row = result?.kind === 'ready' ? result.row : undefined;
  const title = !slug?'이벤트 등록':edit?'이벤트 수정':row?.title ?? '이벤트 정보';
  return <AdminShell email={email} current="events" title={title}><nav className="ops-breadcrumb" aria-label="페이지 이동 경로"><Link href="/admin/events">이벤트 관리</Link><span>/</span><span>{title}</span></nav><div className="ops-heading"><h1>{title}</h1></div>
    {result?.kind === 'error'?<section className="ops-panel" role="alert"><h2>이벤트를 불러오지 못했습니다</h2><p>이벤트 설정 SQL 적용 여부와 조회 권한을 확인해주세요.</p><Link href="/admin/events">목록으로</Link></section>:!slug||edit?<section className="ops-panel">{row&&<p><Link href={`/admin/events/${encodeURIComponent(row.slug)}/information`}>← 이벤트 정보로 돌아가기</Link></p>}<EventEditor row={row}/></section>:row&&<>
    <nav className="ops-tabs" aria-label="이벤트 관리"><Link href={`/admin/events/${row.slug}/overview`} aria-current={!information?"page":undefined}>개요</Link><Link href={`/admin/events/${row.slug}/information`} aria-current={information?"page":undefined}>이벤트 정보</Link><Link href={`/admin/events/${row.slug}/applicants`}>신청자</Link><Link href={`/admin/events/${row.slug}/resources`}>자료</Link></nav>
    {information?<EventInformation row={row}/>:<EventOverview row={row}/>}</>}
  </AdminShell>;
}
