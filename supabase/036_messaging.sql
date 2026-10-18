-- Review and run once after 035-era schema. Does NOT enable real sending.
-- Server credentials are never stored here. Only a one-way hash of a derived worker token.
begin;
create table public.sms_settings(id boolean primary key default true check(id),worker_hash text,initialized_at timestamptz not null default now(), sending_enabled boolean not null default false,notifications_enabled boolean not null default false);
insert into public.sms_settings(id) values(true);
create table public.sms_batches(id uuid primary key,created_by uuid not null references auth.users(id),event_id uuid references public.recruitment_events(id),created_at timestamptz not null default now(),unit_price numeric not null check(unit_price>0),message_type text not null check(message_type in ('SMS','LMS')),kind text not null check(kind in ('manual','test')),approved boolean not null default false);
create table public.sms_jobs(id uuid primary key default gen_random_uuid(),batch_id uuid references public.sms_batches(id),event_id uuid references public.recruitment_events(id),application_source text,application_id uuid,application_revision integer,kind text not null check(kind in ('manual','notification','test')),recipient text,body text not null check(octet_length(body) between 1 and 2000),state text not null default 'queued' check(state in ('draft','queued','dispatching','accepted','delivered','failed','unknown','cancelled')),provider_group text,attempts integer not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create unique index sms_notification_once_idx on public.sms_jobs(application_source,application_id) where kind='notification';
create index sms_pending_idx on public.sms_jobs(state,created_at);
create unique index sms_batch_recipient_idx on public.sms_jobs(batch_id,recipient);
create table public.sms_daily_usage(day date primary key,attempts integer not null default 0);
alter table public.sms_settings enable row level security;
alter table public.sms_settings force row level security;
alter table public.sms_batches enable row level security;
alter table public.sms_batches force row level security;
alter table public.sms_jobs enable row level security;
alter table public.sms_jobs force row level security;
alter table public.sms_daily_usage enable row level security;
alter table public.sms_daily_usage force row level security;
revoke all on public.sms_settings,public.sms_batches,public.sms_jobs,public.sms_daily_usage from public,anon,authenticated;
grant select(sending_enabled,notifications_enabled) on public.sms_settings to authenticated;
grant select on public.sms_batches,public.sms_jobs to authenticated;
create policy sms_settings_read on public.sms_settings for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy sms_batches_read on public.sms_batches for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy sms_jobs_read on public.sms_jobs for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create function public.sms_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.admin_users where user_id=auth.uid())$$;
revoke all on function public.sms_admin() from public;
create function public.sms_initialize(p_hash text) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.sms_admin() or p_hash !~ '^[0-9a-f]{64}$' or p_hash is null then raise exception 'forbidden';end if;
 update public.sms_settings set sending_enabled=case when worker_hash=p_hash then sending_enabled else false end,notifications_enabled=case when worker_hash=p_hash then notifications_enabled else false end,initialized_at=case when worker_hash=p_hash then initialized_at else clock_timestamp() end,worker_hash=p_hash where id;
end $$;
create function public.sms_toggle(p_sending boolean,p_notifications boolean) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.sms_admin() then raise exception 'forbidden';end if;
 if not exists(select 1 from public.sms_settings where worker_hash is not null) then raise exception 'not_initialized';end if;
 if coalesce(p_sending,false) and not exists(select 1 from public.sms_jobs where kind='test' and state='delivered' and created_at>=(select initialized_at from public.sms_settings where id)) then raise exception 'test_required';end if;
 update public.sms_settings set sending_enabled=coalesce(p_sending,false),notifications_enabled=coalesce(p_notifications,false) and coalesce(p_sending,false) where id;
 -- Stopping automatic alerts also cancels unsent alerts; toggling back on never sends a historical backlog.
 if not coalesce(p_notifications,false) or not coalesce(p_sending,false) then update public.sms_jobs set state='cancelled',updated_at=clock_timestamp() where kind='notification' and state='queued';end if;
end $$;
create function public.sms_prepare(p_id uuid,p_event uuid,p_items jsonb,p_price numeric,p_kind text) returns uuid language plpgsql security definer set search_path='' as $$declare item jsonb;begin
 if not public.sms_admin() then raise exception 'forbidden';end if;
 if p_id is null or p_kind not in ('manual','test') or p_kind is null or p_price is null or p_price<=0 or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'invalid';end if;
 if p_event is not null and not exists(select 1 from public.recruitment_events where id=p_event and not is_test and not is_archived) then raise exception 'invalid_event';end if;
 if exists(select 1 from public.sms_batches where id=p_id) then raise exception 'duplicate_batch';end if;
 insert into public.sms_batches(id,created_by,event_id,unit_price,message_type,kind) values(p_id,auth.uid(),p_event,p_price,'LMS',p_kind);
 for item in select value from jsonb_array_elements(p_items) loop
  if coalesce(item->>'to','') !~ '^(010[0-9]{8}|01[16789][0-9]{7,8})$' or coalesce(octet_length(item->>'text'),0) not between 1 and 2000 then raise exception 'invalid';end if;
  insert into public.sms_jobs(batch_id,event_id,kind,recipient,body,state,application_source,application_id,application_revision) values(p_id,p_event,p_kind,item->>'to',item->>'text','draft',item->>'source',(item->>'id')::uuid,(item->>'revision')::integer);
 end loop;
 return p_id;
end $$;
create function public.sms_approve(p_id uuid) returns void language plpgsql security definer set search_path='' as $$declare b public.sms_batches;begin
 if not public.sms_admin() then raise exception 'forbidden';end if;
 select * into b from public.sms_batches where id=p_id for update;
 if not found or b.created_by<>auth.uid() or b.created_at<now()-interval '10 minutes' then raise exception 'expired';end if;
 if b.kind='manual' and not (select sending_enabled from public.sms_settings where id) then raise exception 'disabled';end if;
 if not exists(select 1 from public.sms_settings where worker_hash is not null) then raise exception 'not_initialized';end if;
 if exists(select 1 from public.sms_jobs j where j.batch_id=p_id and j.application_source is not null and not exists(select 1 from public.event_application_admin_list a where a.id=j.application_id and a.source=j.application_source and a.event_id=j.event_id and a.revision=j.application_revision and not a.is_archived)) then raise exception 'recipient_changed';end if;
 if b.event_id is not null and not exists(select 1 from public.recruitment_events where id=b.event_id and not is_archived and not is_test) then raise exception 'recipient_changed';end if;
 update public.sms_batches set approved=true where id=p_id;
 update public.sms_jobs set state='queued',updated_at=clock_timestamp() where batch_id=p_id and state='draft';
end $$;
create function public.sms_notify() returns trigger language plpgsql security definer set search_path='' as $$declare e public.recruitment_events;src text;begin
 if not exists(select 1 from public.sms_settings where id and notifications_enabled and sending_enabled and worker_hash is not null) then return new;end if;
 select * into e from public.recruitment_events where id=new.event_id;
 if e.is_test or e.is_archived or e.slug not in ('season9','halloween-2026') then return new;end if;
 src:=case when tg_table_name='event_applications' then 'season9' else 'registration' end;
 insert into public.sms_jobs(event_id,application_source,application_id,kind,body) values(e.id,src,new.id,'notification','[MALMOIM] New '||case when e.slug='season9' then 'Season 9' else 'Halloween' end||' application. https://admin.malmoim.com/admin') on conflict do nothing;
 return new;
end $$;
create trigger season9_sms_notify after insert on public.event_applications for each row execute function public.sms_notify();
create trigger event_sms_notify after insert on public.event_registration_responses for each row execute function public.sms_notify();
create function public.sms_claim(p_token text,p_batch uuid default null) returns setof public.sms_jobs language plpgsql security definer set search_path='' as $$declare j public.sms_jobs;used integer;begin
 if not exists(select 1 from public.sms_settings where id and worker_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')) then raise exception 'forbidden';end if;
 perform pg_advisory_xact_lock(736360);
 update public.sms_jobs set state='unknown',updated_at=clock_timestamp() where state='dispatching' and updated_at<clock_timestamp()-interval '15 minutes';
 update public.sms_jobs job set state='cancelled',updated_at=clock_timestamp() where state='queued' and kind='manual' and ((event_id is not null and not exists(select 1 from public.recruitment_events e where e.id=job.event_id and not e.is_archived and not e.is_test)) or (application_source is not null and not exists(select 1 from public.event_application_admin_list a where a.id=job.application_id and a.source=job.application_source and a.event_id=job.event_id and a.revision=job.application_revision and not a.is_archived)));
 select * into j from public.sms_jobs where state='queued' and ((p_batch is null and kind='notification') or batch_id=p_batch)
 and (kind='test' or (select sending_enabled from public.sms_settings where id))
 and (kind<>'notification' or (select notifications_enabled from public.sms_settings where id))
 order by created_at,id for update skip locked limit 1;
 if not found then return;end if;
 insert into public.sms_daily_usage(day) values((clock_timestamp() at time zone 'Asia/Seoul')::date) on conflict do nothing;
 select attempts into used from public.sms_daily_usage where day=(clock_timestamp() at time zone 'Asia/Seoul')::date for update;
 if used>=200 then return;end if;
 update public.sms_daily_usage set attempts=attempts+1 where day=(clock_timestamp() at time zone 'Asia/Seoul')::date;
 update public.sms_jobs set state='dispatching',attempts=attempts+1,updated_at=clock_timestamp() where id=j.id returning * into j;
 return next j;
end $$;
create function public.sms_finish(p_token text,p_id uuid,p_state text,p_group text default null) returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from public.sms_settings where id and worker_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')) then raise exception 'forbidden';end if;
 if p_state is null or p_state not in ('accepted','delivered','failed','unknown') then raise exception 'invalid';end if;
 update public.sms_jobs set state=p_state,provider_group=coalesce(p_group,provider_group),updated_at=clock_timestamp() where id=p_id and (state='dispatching' or (state='accepted' and p_state in ('accepted','delivered','failed')));
end $$;
-- No anonymous table read/write, no anonymous queue creation or approval.
revoke all on function public.sms_initialize(text),public.sms_toggle(boolean,boolean),public.sms_prepare(uuid,uuid,jsonb,numeric,text),public.sms_approve(uuid),public.sms_notify(),public.sms_claim(text,uuid),public.sms_finish(text,uuid,text,text) from public;
grant execute on function public.sms_initialize(text),public.sms_toggle(boolean,boolean),public.sms_prepare(uuid,uuid,jsonb,numeric,text),public.sms_approve(uuid) to authenticated;
grant execute on function public.sms_claim(text,uuid),public.sms_finish(text,uuid,text,text) to anon,authenticated;
commit;
