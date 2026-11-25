-- Only future daily requests enqueue alerts; existing requests are not backfilled.
begin;
create or replace function sms_private.notify_daily_participation() returns trigger
language plpgsql security definer set search_path='' as $$
declare applicant text; contact text; session_title text; session_date text; contact_label text;
begin
 if new.kind<>'daily' then return new;end if;
 if not exists(select 1 from public.sms_settings where id and notifications_enabled and sending_enabled and worker_hash is not null) then return new;end if;
 applicant:=left(btrim(regexp_replace(translate(new.name,'{}',''),'[[:cntrl:]]',' ','g')),60);
 contact:=left(btrim(regexp_replace(translate(new.contact,'{}',''),'[[:cntrl:]]',' ','g')),120);
 contact_label:=case new.contact_type when 'phone' then '전화번호' when 'email' then '이메일' else 'Instagram' end;
 session_title:=left(btrim(regexp_replace(translate(coalesce(new.session_snapshot->>'title','일일 참여'),'{}',''),'[[:cntrl:]]',' ','g')),100);
 select to_char(starts_at at time zone 'Asia/Seoul','YYYY-MM-DD HH24:MI') into session_date from public.community_daily_sessions where id=new.session_id;
 insert into public.sms_jobs(application_source,application_id,applicant_name,kind,recipient,body)
 select 'community_daily',new.id,applicant,'notification',r.phone,
  '[말모임] 새 일일 참여 신청'||chr(10)||'신청자: '||applicant||chr(10)||contact_label||': '||contact||chr(10)||
  '일정: '||session_title||chr(10)||coalesce(session_date,'일정 확인 필요')||' (한국시간)'||chr(10)||
  'https://admin.malmoim.com/admin/daily-participation'
 from (select null::text phone union all select phone from sms_private.notification_recipients where enabled) r
 on conflict do nothing;
 return new;
end $$;
revoke all on function sms_private.notify_daily_participation() from public,anon,authenticated;
create trigger daily_participation_sms_notification after insert on public.community_participation_requests
 for each row when(new.kind='daily') execute function sms_private.notify_daily_participation();
commit;
