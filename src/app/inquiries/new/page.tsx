import { Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PublicInquiryForm } from '@/components/inquiries/public-inquiry';
async function InquiryPage({ searchParams }: { searchParams: Promise<{ event?: string; lang?: string }> }) {
 const query = await searchParams;
 const slug = typeof query.event === 'string' ? query.event : '';
 const en = query.lang === 'en';
 let event: { title: string; slug: string } | null = null;
 try { if (/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug)) { const client = await createClient(); const result = await client.rpc('inquiry_event_info', { p_slug: slug }); if (!result.error) event = result.data; } } catch { /* Show unavailable state, never a false receipt. */ }
 return <><Link href={slug==='season9'?(en ? '/season9/en#s9-contact' : '/season9#s9-contact'):'/'}>← {en ? 'MALMOIM' : '말모임으로 돌아가기'}</Link><header><span>CONTACT MALMOIM</span><h1>{en ? 'Ask the organizers' : '운영진 문의'}</h1><p>{event?.title ?? (en ? 'This event is currently unavailable.' : '현재 문의를 접수할 수 없는 이벤트입니다.')}</p></header>{event ? <PublicInquiryForm slug={event.slug} english={en}/> : <section className="inquiry-card"><p>{en ? 'Please retry later or contact us by email.' : '잠시 후 다시 확인하거나 이메일로 문의해주세요.'}</p><a href="mailto:cometomalmoim@gmail.com">cometomalmoim@gmail.com</a></section>}</>;
}
export default function Page(props: { searchParams: Promise<{ event?: string; lang?: string }> }) { return <Suspense fallback={<p>확인 중… / Loading…</p>}><InquiryPage {...props}/></Suspense>; }
