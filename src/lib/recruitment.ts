import {applicationStatuses,paymentStatuses,type ApplicantQuery} from './applicant-validation';
import "server-only";
import { getAdminAccess } from "./auth";
import { createClient } from "./supabase/server";
export type RecruitmentEvent = { id: string; slug: string; title: string; status: string; applications_open: boolean; closes_at: string | null; visual_theme: 'default' | 'halloween' };
export type ApplicationRow = { archive_revision:number;is_archived:boolean; id: string; name: string; contact: string; contact_type: string; preferred_class: string | null; participation_history: string | null; history_detail: string | null; status: string; created_at: string; source:string; birth_year:number|null; nationality:string|null; payment_status:string; internal_note:string; revision:number; source_note:string|null; event_id:string; event_slug?:string; event_title?:string; utm_source:string|null; utm_medium:string|null; utm_campaign:string|null };
export type RecruitmentResult =
  | { kind: "error" }
  | { kind: "missing" }
  | { kind: "ready"; events: RecruitmentEvent[]; event?: RecruitmentEvent; rows: ApplicationRow[]; count: number; page: number };
export async function getRecruitment(slug?: string, page = 1, query:ApplicantQuery={},all=false): Promise<RecruitmentResult> {
  // Recheck inside the data access boundary, not only the page or layout.
  if ((await getAdminAccess()).status !== "admin") return { kind: "error" };
  try {
    const client = await createClient();
    const eventsResult = await client.from("recruitment_events").select("id,slug,title,status,applications_open,closes_at,visual_theme").order("created_at", { ascending: false });
    if (eventsResult.error) return { kind: "error" };
    const events = eventsResult.data as RecruitmentEvent[];
    if (!slug&&!all) return { kind: "ready", events, rows: [], count: 0, page: 1 };
    const event = events.find(e => e.slug === slug);
    if (slug&&!event) return { kind: "missing" };
    const safePage = Number.isSafeInteger(page) && page > 0 ? Math.min(page, 100000) : 1;
    let request=client.from("event_application_admin_list").select("id,name,contact,contact_type,preferred_class,status,created_at,participation_history,history_detail,source,birth_year,nationality,payment_status,internal_note,revision,source_note,event_id,utm_source,utm_medium,utm_campaign,is_archived,archive_revision",{count:'exact'});
    request=request.eq('is_archived',!slug&&query.archived==='1');
    const pageSize=slug?25:10;
    if(event)request=request.eq('event_id',event.id);else if(query.event)request=request.eq('event_id',query.event);
    for(const key of ['utm_source','utm_medium'] as const){const value=(query[key]??'').slice(0,150);if(value==='__unknown')request=request.or(`${key}.is.null,${key}.eq.`);else if(value)request=request.eq(key,value);}
    const search=(query.q??'').slice(0,100).replace(/[^\p{L}\p{N}\s+@_-]/gu,'').trim();
    if(search)request=request.or(`name.ilike.%${search}%,contact.ilike.%${search}%`);
    if(Object.hasOwn(applicationStatuses,query.status??''))request=request.eq('status',query.status!);
    if(Object.hasOwn(paymentStatuses,query.payment??''))request=request.eq('payment_status',query.payment!);
    const nationality=(query.nationality??'').slice(0,100).replace(/[%_,()]/g,'').trim();
    if(nationality)request=request.ilike('nationality',`%${nationality}%`);
    if(/^\d{4}$/.test(query.year??''))request=request.eq('birth_year',Number(query.year));
    const result=await request.order('created_at',{ascending:false}).order('source').order('id',{ascending:false}).range((safePage-1)*pageSize,safePage*pageSize-1);
    if (result.error) return { kind: "error" };
    return { kind: "ready", events, event, rows: (result.data as ApplicationRow[]).map(row=>({...row,event_slug:events.find(e=>e.id===row.event_id)?.slug,event_title:events.find(e=>e.id===row.event_id)?.title})), count: result.count ?? 0, page: safePage };
  } catch { return { kind: "error" }; }
}
