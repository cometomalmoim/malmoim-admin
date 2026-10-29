-- New intake only: no changes to existing events, applicants, members or SMS.
begin;
create table public.community_participation_settings (
 id integer primary key check(id=1), exchange_open boolean not null default true
);
insert into public.community_participation_settings(id) values(1);
create table public.community_daily_sessions (
 id uuid primary key default gen_random_uuid(),title text not null check(length(btrim(title)) between 1 and 100),
 starts_at timestamptz not null,ends_at timestamptz not null,closes_at timestamptz not null,
 location text not null check(length(btrim(location)) between 1 and 200),
 fee integer not null check(fee between 0 and 1000000),
 is_open boolean not null default false,created_at timestamptz not null default now(),
 check(ends_at>starts_at and closes_at<=starts_at)
);
create table public.community_participation_requests (
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('daily','exchange')),
 token_hash text not null unique, session_id uuid references public.community_daily_sessions(id) on delete restrict,
 name text not null check(length(btrim(name)) between 1 and 60),
 contact_type text not null check(contact_type in ('email','phone','instagram')),
 contact text not null check(length(contact) between 1 and 120),
 locale text not null check(locale in ('ko','en')),details jsonb not null check(jsonb_typeof(details)='object'),
 session_snapshot jsonb,
 status text not null default 'received' check(status in ('received','reviewing','confirmed','waitlisted','declined','cancelled')),
 public_message text not null default '' check(length(public_message)<=1000),revision integer not null default 0,
 consent_version text not null default 'community-participation-v1',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 retention_review_at timestamptz not null default now()+interval '3 months',
 check((kind='daily' and session_id is not null) or (kind='exchange' and session_id is null))
);
create index community_request_session_idx on public.community_participation_requests(session_id,status);
create index community_request_kind_time_idx on public.community_participation_requests(kind,created_at desc,id);
create unique index community_request_active_contact_idx on public.community_participation_requests(kind,coalesce(session_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(contact),contact_type)
 where status in ('received','reviewing','confirmed','waitlisted');
create table public.community_request_audit (
 id bigint generated always as identity primary key,request_id uuid not null references public.community_participation_requests(id),
 actor_id uuid references auth.users(id),old_status text not null,new_status text not null,
 created_at timestamptz not null default now()
);
create index community_request_audit_request_idx on public.community_request_audit(request_id);
create index community_request_audit_actor_idx on public.community_request_audit(actor_id);
alter table public.community_participation_settings enable row level security;
alter table public.community_participation_settings force row level security;
alter table public.community_daily_sessions enable row level security;
alter table public.community_daily_sessions force row level security;
alter table public.community_participation_requests enable row level security;
alter table public.community_participation_requests force row level security;
alter table public.community_request_audit enable row level security;
alter table public.community_request_audit force row level security;
revoke all on public.community_participation_settings,public.community_daily_sessions,public.community_participation_requests,public.community_request_audit from public,anon,authenticated;
grant select,update on public.community_participation_settings to authenticated;
grant select,insert,update on public.community_daily_sessions to authenticated;
grant select on public.community_participation_requests,public.community_request_audit to authenticated;
create policy community_settings_admin on public.community_participation_settings for all to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid()))) with check(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy community_sessions_admin on public.community_daily_sessions for all to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid()))) with check(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy community_requests_admin on public.community_participation_requests for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy community_audit_admin on public.community_request_audit for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));

create function public.community_participation_info() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('exchange_open',coalesce((select exchange_open from public.community_participation_settings where id=1),false),
 'sessions',coalesce((select jsonb_agg(x order by x.starts_at,x.id) from (
  select s.id,s.title,s.starts_at,s.ends_at,s.closes_at,s.location,s.fee
  from public.community_daily_sessions s where s.is_open and s.closes_at>now() and s.starts_at>now() order by s.starts_at,s.id limit 100
 ) x),'[]'::jsonb));
$$;
create function public.submit_community_request(p_kind text,p_token text,p_name text,p_contact_type text,p_contact text,p_locale text,p_session uuid,p_details jsonb,p_consent boolean) returns text language plpgsql security definer set search_path='' as $$
declare prior public.community_participation_requests; s public.community_daily_sessions; enabled boolean; th text; clean jsonb; snapshot jsonb; v text; k text;
begin
 if p_kind is null or p_kind not in ('daily','exchange') or p_token is null or p_token !~ '^[a-f0-9]{64}$' or p_name is null or length(btrim(p_name)) not between 1 and 60 or p_contact_type is null or p_contact_type not in ('email','phone','instagram') or p_contact is null or length(btrim(p_contact)) not between 1 and 120 or p_locale is null or p_locale not in ('ko','en') or p_consent is distinct from true or p_details is null or jsonb_typeof(p_details)<>'object' then return 'invalid'; end if;
 p_name:=btrim(p_name);p_contact:=btrim(p_contact);
 if (p_contact_type='email' and p_contact !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') or (p_contact_type='phone' and p_contact !~ '^\+?[0-9 ()-]{8,30}$') or (p_contact_type='instagram' and p_contact !~ '^@?[A-Za-z0-9._]{1,30}$') then return 'invalid';end if;
 -- Canonical contact values close duplicate-submission formatting gaps.
 if p_contact_type='phone' then p_contact:=regexp_replace(p_contact,'[ ()-]','','g');if p_contact !~ '^\+?[0-9]{8,15}$' then return 'invalid';end if;if p_contact ~ '^010[0-9]{8}$' then p_contact:='+82'||substr(p_contact,2);end if;
 elsif p_contact_type='instagram' then p_contact:=lower(ltrim(p_contact,'@'));else p_contact:=lower(p_contact);end if;
 clean:=jsonb_build_object('notes',coalesce(p_details->>'notes',''));if length(clean->>'notes')>500 then return 'invalid';end if;
 if p_kind='daily' then if p_session is null then return 'invalid';end if;
 else
  if p_session is not null then return 'invalid';end if;
  foreach k in array array['offered_language','learning_language'] loop v:=p_details->>k;if v is null or v not in ('ko','en','ja','zh','es','fr','de','other') then return 'invalid';end if;clean:=clean||jsonb_build_object(k,v);end loop;
  if clean->>'offered_language'=clean->>'learning_language' and clean->>'offered_language'<>'other' then return 'invalid';end if;
  foreach k in array array['offered_level','learning_level'] loop v:=p_details->>k;if v is null or v not in ('beginner','intermediate','advanced','native') then return 'invalid';end if;clean:=clean||jsonb_build_object(k,v);end loop;
  v:=p_details->>'meeting_mode';if v is null or v not in ('online','offline','either') then return 'invalid';end if;clean:=clean||jsonb_build_object('meeting_mode',v);
  foreach k in array array['availability','area','other_languages'] loop clean:=clean||jsonb_build_object(k,btrim(coalesce(p_details->>k,'')));end loop;
  if length(clean->>'availability') not between 1 and 200 or length(clean->>'area')>100 or length(clean->>'other_languages')>100 or (clean->>'meeting_mode'<>'online' and clean->>'area'='') or ((clean->>'offered_language'='other' or clean->>'learning_language'='other') and clean->>'other_languages'='') then return 'invalid';end if;
 end if;
 -- Global intake lock makes token retries, duplicate checks and rate limits atomic.
 select exchange_open into enabled from public.community_participation_settings where id=1 for update;
 if not found then return 'closed';end if;
 th:=encode(extensions.digest(p_token,'sha256'),'hex');
 select * into prior from public.community_participation_requests where token_hash=th;
 if found then if prior.kind=p_kind and prior.name=p_name and prior.contact=p_contact and prior.contact_type=p_contact_type and prior.session_id is not distinct from p_session and prior.details=clean and prior.locale=p_locale then return 'saved';end if;return 'invalid';end if;
 if p_kind='exchange' and not enabled then return 'closed';end if;
 if p_kind='daily' then
  select * into s from public.community_daily_sessions where id=p_session for update;
  if not found or not s.is_open or s.closes_at<=clock_timestamp() or s.starts_at<=clock_timestamp() then return 'closed';end if;
  snapshot:=jsonb_build_object('title',s.title,'starts_at',s.starts_at,'ends_at',s.ends_at,'location',s.location,'fee',s.fee);
 end if;
 if exists(select 1 from public.community_participation_requests r where r.kind=p_kind and r.session_id is not distinct from p_session and r.contact=p_contact and r.contact_type=p_contact_type and r.status in ('received','reviewing','confirmed','waitlisted'))then return 'duplicate';end if;
 if (select count(*) from public.community_participation_requests where kind=p_kind and created_at>now()-interval '1 hour')>=100 then return 'rate_limited';end if;
 insert into public.community_participation_requests(kind,token_hash,session_id,name,contact_type,contact,locale,details,session_snapshot)values(p_kind,th,p_session,p_name,p_contact_type,p_contact,p_locale,clean,snapshot);
 return 'saved';
end $$;
create function public.read_community_request(p_token text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('kind',kind,'name',name,'status',status,'message',public_message,'created_at',created_at,'locale',locale,'session',session_snapshot)
 from public.community_participation_requests where p_token ~ '^[a-f0-9]{64}$' and token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
$$;
create function public.cancel_community_request(p_token text) returns text language plpgsql security definer set search_path='' as $$
declare r public.community_participation_requests;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return 'missing';end if;
 select * into r from public.community_participation_requests where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if not found then return 'missing';end if;
 if r.status in ('declined','cancelled') then return 'saved';end if;
 update public.community_participation_requests set status='cancelled',revision=revision+1,updated_at=now() where id=r.id;
 insert into public.community_request_audit(request_id,old_status,new_status)values(r.id,r.status,'cancelled');return 'saved';
end $$;
create function public.manage_community_request(p_id uuid,p_revision integer,p_status text,p_message text) returns text language plpgsql security definer set search_path='' as $$
declare r public.community_participation_requests; s public.community_daily_sessions;
begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid())then return 'forbidden';end if;
 if p_status is null or p_status not in ('received','reviewing','confirmed','waitlisted','declined','cancelled') or p_message is null or length(p_message)>1000 then return 'invalid';end if;
 -- Same lock order as intake, then request. Cancellation never acquires a session lock.
 perform 1 from public.community_participation_settings where id=1 for update;
 select * into r from public.community_participation_requests where id=p_id for update;
 if not found then return 'missing';end if;
 if p_revision is null or p_revision<>r.revision then return 'stale';end if;
 update public.community_participation_requests set status=p_status,public_message=btrim(p_message),revision=revision+1,updated_at=now()where id=r.id;
 insert into public.community_request_audit(request_id,actor_id,old_status,new_status)values(r.id,auth.uid(),r.status,p_status);return 'saved';
end $$;
revoke all on function public.community_participation_info(),public.submit_community_request(text,text,text,text,text,text,uuid,jsonb,boolean),public.read_community_request(text),public.cancel_community_request(text),public.manage_community_request(uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.community_participation_info(),public.submit_community_request(text,text,text,text,text,text,uuid,jsonb,boolean),public.read_community_request(text),public.cancel_community_request(text) to anon,authenticated;
grant execute on function public.manage_community_request(uuid,integer,text,text) to authenticated;
commit;
