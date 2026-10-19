import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { inquiryReceiptUrl, inquiryUuid } from '@/lib/inquiry-validation';
import { AdminShell } from './admin-shell';
import { InquiryReplyForm, InquiryReplyLink } from './inquiry-reply-form';
import './inquiries.css';
type Query = { event?: string; status?: string; q?: string };
type Inquiry = { id: string; event_id: string; name: string; subject: string; content: string; status: string; revision: number; receipt_token: string; created_at: string; locale: string; event_inquiry_replies: { id: string; body: string; created_at: string }[] };
export async function InquiriesView({ email, slug, query = {}, page = 1 }: { email: string; slug?: string; query?: Query; page?: number }) {
 let events: {kind:'ready';events:{id:string;slug:string;title:string}[]}|{kind:'error'}={kind:'error'};
 try { const client=await createClient(); const all:{id:string;slug:string;title:string}[]=[]; for(let offset=0;;offset+=100){const result=await client.from('recruitment_events').select('id,slug,title').order('created_at',{ascending:false}).order('id').range(offset,offset+99);if(result.error)throw new Error('events');all.push(...result.data);if(result.data.length<100)break;}events={kind:'ready',events:all}; }catch{/* Preserve an explicit error state. */}
 const event = events.kind === 'ready' && slug ? events.events.find(row => row.slug === slug) : undefined;
 if (slug && events.kind === 'ready' && !event) notFound();
 const eventId = event?.id ?? (inquiryUuid(query.event ?? '') ? query.event : undefined);
 const selectedStatus = ['received', 'answered'].includes(query.status ?? '') ? query.status! : '';
 const search = (query.q ?? '').slice(0, 100).replace(/[^\p{L}\p{N}\s-]/gu, '').trim();
 const currentPage = Number.isSafeInteger(page) && page > 0 ? Math.min(page, 100000) : 1;
 const base = slug ? `/admin/events/${encodeURIComponent(slug)}/inquiries` : '/admin/inquiries';
 let rows: Inquiry[] = [], count = 0, failed = events.kind === 'error';
 try {
  const client = await createClient();
  let request = client.from('event_inquiries').select('id,event_id,name,subject,content,status,revision,receipt_token,created_at,locale,event_inquiry_replies(id,body,created_at)', { count: 'exact' });
  if (eventId) request = request.eq('event_id', eventId);
  if (selectedStatus) request = request.eq('status', selectedStatus);
  if (search) request = request.or(`name.ilike.%${search}%,subject.ilike.%${search}%`);
  const result = await request.order('created_at', { ascending: false }).order('id').range((currentPage - 1) * 20, currentPage * 20 - 1);
  failed ||= !!result.error;
  rows = (result.data ?? []) as Inquiry[]; count = result.count ?? 0;
 } catch { failed = true; }
 const pageHref = (number: number) => `${base}?${new URLSearchParams({ ...(eventId ? { event: eventId } : {}), status: selectedStatus, q: search, page: String(number) })}`;
 const date = (value: string) => new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' });
 return <AdminShell email={email} current={slug ? 'events' : 'inquiries'} title={event ? `${event.title} · 문의 확인하기` : '전체 문의 보기'}><div className="inbox"><nav className="ops-breadcrumb"><Link href="/admin/events">이벤트 관리</Link>{event && <><span>/</span><Link href={`/admin/events/${encodeURIComponent(event.slug)}/overview`}>이벤트 홈</Link></>}<span>/</span><span>문의 확인하기</span></nav><div className="ops-heading"><h1>{event ? `${event.title} · 문의 확인하기` : '전체 문의 보기'}</h1><p>{event ? '이 이벤트에 접수된 문의와 답변을 확인합니다.' : '모든 이벤트의 문의를 한곳에서 확인하고 답변합니다.'}</p></div><p className="ops-muted">{event ? <Link href={`/inquiries/new?event=${encodeURIComponent(event.slug)}`} target="_blank">이벤트 문의 접수 페이지 열기 ↗</Link> : "이벤트 필터를 선택하면 해당 이벤트의 문의만 확인할 수 있습니다."}</p><form className="ops-panel inbox-filters" method="get" action={base}>{!slug && <label>이벤트<select name="event" defaultValue={eventId ?? ''}><option value="">전체 이벤트</option>{events.kind === 'ready' && events.events.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}<label>처리 상태<select name="status" defaultValue={selectedStatus}><option value="">전체</option><option value="received">답변 대기</option><option value="answered">답변 완료</option></select></label><label>검색<input name="q" defaultValue={search} maxLength={100} placeholder="이름·문의 제목"/></label><button>조회</button><Link href={base}>초기화</Link></form>{failed ? <section className="ops-panel" role="alert"><h2>문의를 불러오지 못했습니다</h2><p>문의 DB 적용 상태와 관리자 권한·연결을 확인해주세요.</p></section> : <><p className="ops-muted">총 {count}건 · 페이지당 20건 · 답변은 전용 링크에서만 확인할 수 있습니다.</p>{!rows.length && <section className="ops-panel">조건에 맞는 문의가 없습니다.</section>}{rows.map(row => {
 const rowEvent = events.kind === 'ready' ? events.events.find(item => item.id === row.event_id) : undefined;
 const replies = [...row.event_inquiry_replies].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
 return <details key={row.id} className="ops-panel inbox-item"><summary><span className={`inbox-status ${row.status}`}>{row.status === 'answered' ? '답변 완료' : '답변 대기'}</span><strong>{row.subject}</strong><span>{row.name} · {rowEvent?.title ?? '이벤트'}</span><time>{date(row.created_at)}</time></summary><div className="inbox-content"><p className="inbox-text">{row.content}</p><p className="ops-muted">문의 언어: {row.locale === 'en' ? '영어' : '한국어'}</p>{replies.map(reply => <article className="inbox-reply" key={reply.id}><strong>운영진 답변 · {date(reply.created_at)}</strong><p className="inbox-text">{reply.body}</p></article>)}<InquiryReplyForm key={`${row.id}:${row.revision}`} id={row.id} revision={row.revision}/><div className="inbox-links"><InquiryReplyLink href={inquiryReceiptUrl(row.receipt_token)}/><Link href="/admin/messages">메시징에서 답변 완료 안내 준비 →</Link></div><p className="ops-muted">문자로 안내할 때 전용 링크를 복사하여 ‘문의 답변 완료’ 템플릿에 넣어주세요. 문의자 한 명에게만 전달하세요.</p></div></details>})}<nav className="inbox-pagination" aria-label="문의 페이지">{currentPage > 1 && <Link href={pageHref(currentPage - 1)}>← 이전</Link>}<span>{currentPage} / {Math.max(1, Math.ceil(count / 20))}</span>{currentPage * 20 < count && <Link href={pageHref(currentPage + 1)}>다음 →</Link>}</nav></>}</div></AdminShell>;
}
