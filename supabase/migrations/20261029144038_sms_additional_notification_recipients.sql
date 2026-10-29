-- Additional recipients are configured privately, never committed in source.
begin;
create schema if not exists sms_private;
revoke all on schema sms_private from public,anon;
create table sms_private.notification_recipients (
 phone text primary key check(phone ~ '^010[0-9]{8}$'),
 enabled boolean not null default true
);
alter table sms_private.notification_recipients enable row level security;
revoke all on sms_private.notification_recipients from public,anon,authenticated;
-- NULL represents the original server-configured recipient; existing history stays unchanged.
drop index public.sms_notification_once_idx;
create unique index sms_notification_once_idx
 on public.sms_jobs(application_source,application_id,coalesce(recipient,'')) where kind='notification';
create or replace function public.sms_notify() returns trigger
language plpgsql security definer set search_path='' as $$
declare e public.recruitment_events; src text; event_label text; applicant_label text;
begin
 if not exists(select 1 from public.sms_settings where id and notifications_enabled and sending_enabled and worker_hash is not null) then return new;end if;
 select * into e from public.recruitment_events where id=new.event_id;
 if not found or e.is_test or e.is_archived or e.slug not in ('season9','halloween-2026') then return new;end if;
 src:=case when tg_table_name='event_applications' then 'season9' else 'registration' end;
 -- Keep user-provided text on its own line; braces must not be treated as template variables.
 event_label:=left(btrim(regexp_replace(translate(e.title,'{}',''), '[[:cntrl:]]', ' ', 'g')),80);
 applicant_label:=left(btrim(regexp_replace(translate(new.name,'{}',''), '[[:cntrl:]]', ' ', 'g')),100);
 insert into public.sms_jobs(event_id,application_source,application_id,kind,recipient,body)
 select e.id,src,new.id,'notification',r.phone,
  '[말모임] 새 참가 신청' || chr(10) || '이벤트: ' || event_label || chr(10) ||
  '신청자: ' || applicant_label || chr(10) || 'https://admin.malmoim.com/admin/events/' || e.slug || '/applicants'
 from (select null::text phone union all select phone from sms_private.notification_recipients where enabled) r
 on conflict do nothing;
 return new;
end $$;
-- Preserve the original trigger-only invocation boundary.
revoke all on function public.sms_notify() from public,anon,authenticated;
commit;
