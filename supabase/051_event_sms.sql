-- Additive; does not enable sending, enqueue alerts, or contact recipients.
begin;
create table public.event_sms_templates(
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.recruitment_events,
 template_key uuid not null, version integer not null check(version>0),
 category text not null check(category in ('receipt','payment','confirmation','reminder','custom')),
 language text not null check(language in ('ko','en')), title text not null check(length(title) between 1 and 120),
 body text not null check(octet_length(body) between 1 and 2000), active boolean not null default true,
 is_default boolean not null default false, created_at timestamptz not null default now(),
 created_by uuid references auth.users, unique(template_key,version));
create table public.event_sms_details(event_id uuid primary key references public.recruitment_events, values jsonb not null default '{}', revision integer not null default 1);
create table public.applicant_sms_details(event_id uuid not null references public.recruitment_events, source text not null, application_id uuid not null, language text check(language in ('ko','en')), fee text not null default '', primary key(event_id,source,application_id));
alter table public.sms_jobs add column template_id uuid references public.event_sms_templates, add column applicant_name text, add column language text, add column resend boolean not null default false, add column failure_reason text, add column message_type text not null default 'LMS' check(message_type in ('SMS','LMS'));
create table public.sms_job_history(id bigint generated always as identity primary key, job_id uuid not null references public.sms_jobs, state text not null, happened_at timestamptz not null default clock_timestamp(), actor uuid, provider_group text, failure_reason text);
create index sms_applicant_idx on public.sms_jobs(event_id,application_source,application_id,created_at desc);
create unique index sms_applicant_pending_idx on public.sms_jobs(event_id,application_source,application_id) where template_id is not null and state in ('draft','queued','dispatching','accepted','unknown');
alter table public.event_sms_templates enable row level security;
alter table public.event_sms_templates force row level security;
revoke all on public.event_sms_templates from public,anon,authenticated;
grant select on public.event_sms_templates to authenticated;
create policy admin_read on public.event_sms_templates for select to authenticated using(public.sms_admin());
alter table public.event_sms_details enable row level security;
alter table public.event_sms_details force row level security;
revoke all on public.event_sms_details from public,anon,authenticated;
grant select on public.event_sms_details to authenticated;
create policy admin_read on public.event_sms_details for select to authenticated using(public.sms_admin());
alter table public.applicant_sms_details enable row level security;
alter table public.applicant_sms_details force row level security;
revoke all on public.applicant_sms_details from public,anon,authenticated;
grant select on public.applicant_sms_details to authenticated;
create policy admin_read on public.applicant_sms_details for select to authenticated using(public.sms_admin());
alter table public.sms_job_history enable row level security;
alter table public.sms_job_history force row level security;
revoke all on public.sms_job_history from public,anon,authenticated;
grant select on public.sms_job_history to authenticated;
create policy admin_read on public.sms_job_history for select to authenticated using(public.sms_admin());
grant execute on function public.sms_admin() to authenticated;
create view public.event_sms_current with(security_invoker=true) as select distinct on(template_key) * from public.event_sms_templates order by template_key,version desc;
grant select on public.event_sms_current to authenticated;
create view public.event_sms_applicant_status with(security_invoker=true) as select distinct on(event_id,application_source,application_id) event_id,application_source,application_id,state,updated_at from public.sms_jobs where template_id is not null order by event_id,application_source,application_id,created_at desc,id;
grant select on public.event_sms_applicant_status to authenticated;
create function public.save_event_sms_template(p_event uuid,p_key uuid,p_version integer,p_input jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare t public.event_sms_templates; prior public.event_sms_templates; k uuid:=coalesce(p_key,gen_random_uuid()); result uuid;
begin
 if not public.sms_admin() then raise exception 'forbidden';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,51));
 if not exists(select 1 from public.recruitment_events where id=p_event and not is_archived) then raise exception 'event';end if;
 select * into t from public.event_sms_templates where template_key=k order by version desc limit 1;
 if (found and (t.event_id<>p_event or t.version<>p_version)) or (not found and p_version<>0) then raise exception 'conflict';end if;
 if (p_input->>'is_default')::boolean then
  for prior in select * from public.event_sms_current where event_id=p_event and category=p_input->>'category' and language=p_input->>'language' and is_default and template_key<>k loop
   insert into public.event_sms_templates(event_id,template_key,version,category,language,title,body,active,is_default,created_by) values(prior.event_id,prior.template_key,prior.version+1,prior.category,prior.language,prior.title,prior.body,prior.active,false,auth.uid());
  end loop;
 end if;
 insert into public.event_sms_templates(event_id,template_key,version,category,language,title,body,active,is_default,created_by)
 values(p_event,k,p_version+1,p_input->>'category',p_input->>'language',p_input->>'title',p_input->>'body',(p_input->>'active')::boolean,(p_input->>'is_default')::boolean,auth.uid()) returning id into result;
 return result;
end $$;
create function public.save_event_sms_details(p_event uuid,p_revision integer,p_values jsonb) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.sms_admin() then raise exception 'forbidden';end if;
 if jsonb_typeof(p_values)<>'object' or octet_length(p_values::text)>4000 then raise exception 'invalid';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,51));
 if coalesce((select revision from public.event_sms_details where event_id=p_event),0)<>p_revision then raise exception 'conflict';end if;
 insert into public.event_sms_details(event_id,values) values(p_event,p_values) on conflict(event_id) do update set values=excluded.values,revision=public.event_sms_details.revision+1;
end $$;
create function public.prepare_applicant_sms(p_batch uuid,p_event uuid,p_source text,p_app uuid,p_revision integer,p_template uuid,p_text text,p_price numeric,p_type text,p_resend boolean,p_language text,p_fee text) returns uuid language plpgsql security definer set search_path='' as $$
declare a record; t public.event_sms_templates; phone text;
begin
 if not public.sms_admin() then raise exception 'forbidden';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_event::text||p_source||p_app::text,51));
 -- Expired previews cannot block an applicant indefinitely.
 update public.sms_jobs set state='cancelled',updated_at=clock_timestamp() where event_id=p_event and application_source=p_source and application_id=p_app and template_id is not null and state='draft' and created_at<now()-interval '10 minutes';
 -- A repeated network request returns its original immutable preview.
 if exists(select 1 from public.sms_batches where id=p_batch and created_by=auth.uid()) then return p_batch;end if;
 select * into a from public.event_application_admin_list where event_id=p_event and source=p_source and id=p_app and not is_archived;
 if not found or a.revision<>p_revision or a.contact_type<>'phone' then raise exception 'recipient_changed';end if;
 select * into t from public.event_sms_current where id=p_template and event_id=p_event and active and language=p_language;
 if not found then raise exception 'template_changed';end if;
 if t.category='confirmation' and (a.status<>'accepted' or a.payment_status<>'paid') then raise exception 'payment_required';end if;
 if p_type not in ('SMS','LMS') or (p_type='SMS' and octet_length(p_text)>90) or p_text ~ '[{}]' then raise exception 'invalid_text';end if;
 if exists(select 1 from public.sms_jobs where event_id=p_event and application_source=p_source and application_id=p_app and template_id is not null and state in ('draft','queued','dispatching','accepted','unknown')) then raise exception 'pending_or_unknown';end if;
 if not coalesce(p_resend,false) and exists(select 1 from public.sms_jobs where event_id=p_event and application_source=p_source and application_id=p_app and template_id is not null and state='delivered') then raise exception 'resend_confirmation_required';end if;
 phone:=regexp_replace(a.contact,'[ ()-]','','g');
 if phone like '+82%' then phone:='0'||substr(phone,4);elsif phone like '0082%' then phone:='0'||substr(phone,5);end if;
 perform public.sms_prepare(p_batch,p_event,jsonb_build_array(jsonb_build_object('to',phone,'text',p_text,'source',p_source,'id',p_app,'revision',p_revision)),p_price,'manual');
 update public.sms_batches set message_type=p_type where id=p_batch;
 update public.sms_jobs set template_id=p_template,applicant_name=a.name,language=p_language,resend=p_resend,message_type=p_type where batch_id=p_batch;
 insert into public.applicant_sms_details(event_id,source,application_id,language,fee) values(p_event,p_source,p_app,p_language,left(p_fee,100)) on conflict(event_id,source,application_id) do update set language=excluded.language,fee=excluded.fee;
 return p_batch;
end $$;
create function public.event_sms_guard() returns trigger language plpgsql security definer set search_path='' as $$declare t public.event_sms_templates;begin
 if new.template_id is not null and new.state in ('queued','dispatching') and new.state is distinct from old.state then
  select * into t from public.event_sms_current where id=new.template_id and active;
  if not found then raise exception 'template_changed';end if;
  if t.category='confirmation' and not exists(select 1 from public.event_application_admin_list where id=new.application_id and source=new.application_source and event_id=new.event_id and status='accepted' and payment_status='paid' and not is_archived) then raise exception 'payment_required';end if;
 end if;
 return new;
end $$;
create trigger event_sms_guard before update of state on public.sms_jobs for each row execute function public.event_sms_guard();
create function public.audit_sms_job() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_op='INSERT' or new.state is distinct from old.state then
 insert into public.sms_job_history(job_id,state,actor,provider_group,failure_reason) values(new.id,new.state,auth.uid(),new.provider_group,case when new.state='failed' then coalesce(new.failure_reason,'업체 거절 또는 전달 실패: SOLAPI 상세 확인') when new.state='unknown' then '업체 결과 불명: 재발송 금지' else new.failure_reason end);
 end if;return new;
end $$;
create trigger audit_sms_job after insert or update on public.sms_jobs for each row execute function public.audit_sms_job();
-- Existing logs retained; no synthetic historical status transitions.
insert into public.sms_job_history(job_id,state,provider_group) select id,state,provider_group from public.sms_jobs;
create function public.cancel_applicant_sms_preview(p_batch uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.sms_admin() then raise exception 'forbidden';end if;
 update public.sms_jobs set state='cancelled',updated_at=clock_timestamp() where batch_id=p_batch and state='draft' and template_id is not null and exists(select 1 from public.sms_batches where id=p_batch and created_by=auth.uid());
end $$;
revoke all on function public.save_event_sms_template(uuid,uuid,integer,jsonb),public.save_event_sms_details(uuid,integer,jsonb),public.prepare_applicant_sms(uuid,uuid,text,uuid,integer,uuid,text,numeric,text,boolean,text,text),public.cancel_applicant_sms_preview(uuid),public.event_sms_guard(),public.audit_sms_job() from public;
grant execute on function public.save_event_sms_template(uuid,uuid,integer,jsonb),public.save_event_sms_details(uuid,integer,jsonb),public.prepare_applicant_sms(uuid,uuid,text,uuid,integer,uuid,text,numeric,text,boolean,text,text),public.cancel_applicant_sms_preview(uuid) to authenticated;

-- User-confirmed event end time; only the existing Halloween event is updated.
update public.recruitment_events set ends_at='2026-10-31 23:30:00+09' where slug='halloween-2026' and not is_archived;
insert into public.event_sms_details(event_id,values) select id,'{"은행":"토스뱅크","계좌번호":"1002-0735-3590","예금주":"이상현(모임통장)","영문은행":"Toss Bank","영문예금주":"Lee Sang-hyeon (Group Account)","영문행사명":"2026 MalMoim Halloween Party","영문장소":"B1, 16-16 Yeonseo-ro 27-gil, Eunpyeong-gu, Seoul"}'::jsonb from public.recruitment_events where slug='halloween-2026' and not is_archived on conflict do nothing;
insert into public.event_sms_templates(event_id,template_key,version,category,language,title,body,active,is_default) select id,gen_random_uuid(),1,'payment','ko','할로윈 참가비 입금 요청','🎃 [{행사명} 신청 안내]

안녕하세요, {이름}님!
말모임 할로윈 파티에 신청해 주셔서 감사합니다.

📅 날짜: {행사일}
⏰ 시간: {시작시간} ~ {종료시간} (한국 시간)
📍 장소: {장소}

💰 참가비: {참가비}
🏦 {은행} {계좌번호}
예금주: {예금주}

참가비 입금 확인 및 운영진 승인 후 최종 참가가 확정됩니다.
코스튬 착용은 필수가 아니니 부담 없이 편하게 오세요! 👻

말모임 운영진 드림',true,true from public.recruitment_events where slug='halloween-2026' and not is_archived;
insert into public.event_sms_templates(event_id,template_key,version,category,language,title,body,active,is_default) select id,gen_random_uuid(),1,'confirmation','ko','할로윈 최종 참가 확정','🎃 [{행사명} 참가 확정]

안녕하세요, {이름}님!
참가비 입금이 확인되어 할로윈 파티 참가가 최종 확정되었습니다! 🎉

📅 날짜: {행사일}
⏰ 시간: {시작시간} ~ {종료시간} (한국 시간)
📍 장소: {장소}

코스튬 착용은 필수가 아닙니다.
부담 없이 편하게 오셔서 함께 즐거운 시간 보내요!

말모임 운영진 드림',true,true from public.recruitment_events where slug='halloween-2026' and not is_archived;
insert into public.event_sms_templates(event_id,template_key,version,category,language,title,body,active,is_default) select id,gen_random_uuid(),1,'payment','en','Halloween Payment Request','🎃 [{행사명} Registration]

Hi {이름}!
Thank you for registering for the Halloween Party!

📅 Date: {행사일}
⏰ Time: {시작시간} – {종료시간} (KST)
📍 Location: {장소}

💰 Fee: {참가비}
🏦 Bank: {은행}
Account: {계좌번호}
Account Holder: {예금주}

Your spot will be officially confirmed once your payment and participation have been approved.
Costumes are completely optional, so feel free to come as you are! 👻

Team MalMoim',true,true from public.recruitment_events where slug='halloween-2026' and not is_archived;
insert into public.event_sms_templates(event_id,template_key,version,category,language,title,body,active,is_default) select id,gen_random_uuid(),1,'confirmation','en','Halloween Final Confirmation','🎃 [{행사명} Confirmation]

Hi {이름}!
Your payment has been verified, and your spot at the Halloween Party is officially confirmed! 🎉

📅 Date: {행사일}
⏰ Time: {시작시간} – {종료시간} (KST)
📍 Location: {장소}

Costumes are optional, so there is no pressure to dress up!
We cannot wait to see you there! 🎃

Team MalMoim',true,true from public.recruitment_events where slug='halloween-2026' and not is_archived;

commit;
