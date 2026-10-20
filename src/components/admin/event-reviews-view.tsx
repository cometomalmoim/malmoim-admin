import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getEvent} from '@/lib/events';
import {createClient} from '@/lib/supabase/server';
import {AdminShell} from './admin-shell';
import {EventReviewEditor,type ReviewRow} from './event-review-editor';
import './event-reviews.css';
export async function EventReviewsView({email,slug}:{email:string;slug:string}){
 const event=await getEvent(slug);if(event.kind==='missing')notFound();
 const rows:ReviewRow[]=[];let failed=event.kind!=='ready';
 if(event.kind==='ready')try{const client=await createClient();for(let offset=0;;offset+=100){const result=await client.from('event_landing_reviews').select('id,display_name,locale,body,source_note,sort_order,published,publication_confirmed,revision').eq('event_id',event.row.id).order('sort_order').order('created_at').order('id').range(offset,offset+99);if(result.error){failed=true;break;}rows.push(...result.data);if(result.data.length<100)break;}}catch{failed=true;}
 return <AdminShell email={email} current="events" title="후기 관리"><div className="event-reviews"><nav className="ops-breadcrumb"><Link href="/admin/events">이벤트 관리</Link><span>/</span><Link href={`/admin/events/${encodeURIComponent(slug)}/overview`}>이벤트 홈</Link><span>/</span><span>후기 관리</span></nav><div className="ops-heading"><h1>{event.kind==='ready'?`${event.row.title} · 후기 관리`:'후기 관리'}</h1><p>한국어·영어 후기 원문을 등록하고 표시 이름·순서·공개 여부를 관리합니다.</p></div>{failed?<section className="ops-panel" role="alert">후기를 불러오지 못했습니다. DB 적용 상태와 권한을 확인해주세요.</section>:event.kind==='ready'&&<><section className="ops-panel"><p><strong>등록 {rows.length}개 · 공개 {rows.filter(row=>row.published).length}개</strong></p><p>공개한 후기만 방문자에게 보입니다. 비공개로 저장한 초안과 운영 메모는 공개되지 않습니다. 공개된 후기가 없으면 기존 모임 소개 문장을 표시합니다.</p>{slug==='season9'&&<Link href="https://malmoim.com/season9#s9-moments" target="_blank">모집페이지에서 확인 ↗</Link>}<p className="ops-muted">후기를 내리려면 ‘랜딩페이지에 공개’를 해제하고 저장하세요. 등록된 후기는 보존됩니다.</p></section><details className="ops-panel"><summary>＋ 후기 추가</summary><EventReviewEditor key={`new-${rows.length}`} eventId={event.row.id}/></details>{rows.length?rows.map(row=><details className="ops-panel" key={`${row.id}:${row.revision}`}><summary><strong>{row.published?'공개':'비공개'} · {row.display_name}</strong> · {row.locale==='en'?'English':'한국어'} · 순서 {row.sort_order}<p>{row.body.slice(0,100)}{row.body.length>100?'…':''}</p></summary><EventReviewEditor eventId={event.row.id} row={row}/></details>):<section className="ops-panel">등록된 후기가 없습니다. 실제 후기가 준비되면 위에서 추가해주세요.</section>}</>}</div></AdminShell>;
}
