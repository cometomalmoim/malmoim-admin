-- MANUAL REVIEW CANDIDATE. Never auto-run in a live Supabase project.
-- Additive extension ONLY after inspecting the installed profile/board metadata.
-- Does not create accounts, activate registration, change board RPC/RLS, rename
-- existing authors, delete rows, or implement account withdrawal.
begin;
do $preflight$
begin
 if current_setting('server_encoding')<>'UTF8' then raise exception 'UTF8 required';end if;
 if not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then raise exception 'Reviewed BYPASSRLS migration owner required';end if;
 if to_regclass('public.member_profiles') is null or to_regclass('public.board_aliases') is null or
    to_regprocedure('public.save_member_profile(jsonb,jsonb,text)') is null or
    to_regprocedure('public.member_registration_ready()') is null then raise exception 'Review/apply profile prerequisites separately; do not rerun old drafts';end if;
 if to_regclass('public.member_registration_policies') is not null or to_regclass('public.member_policy_acceptances') is not null or
    to_regprocedure('public.save_member_registration_v2(text,jsonb,jsonb,text,text,text,boolean,boolean)') is not null then raise exception 'Objects already exist; inspect instead of recreating';end if;
 if exists(select 1 from pg_attribute where attrelid='public.board_aliases'::regclass and attname in ('nickname_key','nickname_chosen') and not attisdropped) then raise exception 'Alias extension already exists';end if;
 if exists(select 1 from public.board_aliases group by lower(normalize(nickname,NFKC)) having count(*)>1) then raise exception 'Existing normalized aliases collide. Resolve by reviewed, individual migration; never silently rename';end if;
 -- Existing direct profile writes must be closed; otherwise the new consent path
 -- could be bypassed. The legacy draft returns null until separate approval.
 if public.member_registration_ready() is not null then raise exception 'Legacy registration is active: review all callers and policy migration before applying';end if;
end $preflight$;

alter table public.board_aliases add column nickname_key text generated always as (lower(normalize(nickname,NFKC))) stored;
alter table public.board_aliases add column nickname_chosen boolean not null default false;
create unique index board_aliases_nickname_key_unique on public.board_aliases(nickname_key);

create table public.member_registration_policies(
 collection_version text primary key check(length(collection_version) between 1 and 100),
 terms_version text not null check(length(terms_version) between 1 and 100),
 privacy_version text not null check(length(privacy_version) between 1 and 100),
 collection_basis text not null check(collection_basis in ('consent','contract')),
 terms_snapshot jsonb not null check(jsonb_typeof(terms_snapshot)='object'),
 privacy_snapshot jsonb not null check(jsonb_typeof(privacy_snapshot)='object'),
 collection_snapshot jsonb not null check(jsonb_typeof(collection_snapshot)='object'),
 -- collection_version identifies the entire immutable acceptance bundle. A new
 -- document change after first acceptance requires a new bundle ID.
 check((terms_snapshot->>'version'=terms_version and privacy_snapshot->>'version'=privacy_version and collection_snapshot->>'version'=collection_version) is true),
 enabled boolean not null default false,created_at timestamptz not null default now()
);
create unique index member_registration_one_enabled on public.member_registration_policies(enabled) where enabled;
create table public.member_policy_acceptances(
 user_id uuid not null references auth.users(id), -- NO automatic deletion until retention/deletion review.
 collection_version text not null references public.member_registration_policies(collection_version),
 terms_accepted boolean not null check(terms_accepted),
 collection_accepted boolean not null,
 accepted_at timestamptz not null default clock_timestamp(),primary key(user_id,collection_version)
);
alter table public.member_registration_policies enable row level security;
alter table public.member_registration_policies force row level security;
alter table public.member_policy_acceptances enable row level security;
alter table public.member_policy_acceptances force row level security;
revoke all on public.member_registration_policies,public.member_policy_acceptances from public,anon,authenticated;

create function public.member_registration_policy_immutable() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.collection_version is distinct from old.collection_version then raise exception 'Policy bundle identity cannot change';end if;
 -- The row UPDATE lock serializes against the FOR SHARE lock in signup RPCs.
 -- Complete document metadata before first use; used snapshots are immutable.
 if exists(select 1 from public.member_policy_acceptances where collection_version=old.collection_version) and
    (to_jsonb(new)-'enabled') is distinct from (to_jsonb(old)-'enabled') then
  raise exception 'Accepted policy versions and snapshots are immutable. Insert a new bundle';
 end if;
 return new;
end $$;
revoke all on function public.member_registration_policy_immutable() from public,anon,authenticated;
create trigger member_registration_policy_immutable before update on public.member_registration_policies for each row execute function public.member_registration_policy_immutable();

-- Acceptance evidence is append-only. Reaccepting an existing bundle is a no-op.
create function public.member_policy_acceptance_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Acceptance evidence is immutable; insert a new policy bundle acceptance';end $$;
revoke all on function public.member_policy_acceptance_immutable() from public,anon,authenticated;
create trigger member_policy_acceptance_immutable before update on public.member_policy_acceptances for each row execute function public.member_policy_acceptance_immutable();

create function public.member_registration_v2_ready() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('terms_version',terms_version,'privacy_version',privacy_version,'collection_version',collection_version,'requires_consent',collection_basis='consent','enabled',enabled)
 from public.member_registration_policies where enabled and collection_version=public.member_registration_ready()
$$;
revoke all on function public.member_registration_v2_ready() from public,anon,authenticated;
grant execute on function public.member_registration_v2_ready() to anon,authenticated;

create function public.member_nickname_valid(p_nickname text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(p_nickname ~ '^[A-Za-z0-9가-힣_]{2,20}$' and
  replace(lower(p_nickname),'_','') !~ '^(admin|administrator|moderator|system|staff|official|malmoim|formermember|관리자|운영자|운영진|시스템|공식|말모임|탈퇴한회원)',false)
$$;
revoke all on function public.member_nickname_valid(text) from public,anon,authenticated;
alter table public.board_aliases add constraint member_chosen_nickname_valid
 check(not nickname_chosen or public.member_nickname_valid(nickname));

create function public.member_nickname_available(p_nickname text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare selected text:=btrim(normalize(p_nickname,NFKC));
begin
 if public.member_registration_v2_ready() is null then return null;end if;
 if not public.member_nickname_valid(selected) then return false;end if;
 return not exists(select 1 from public.board_aliases where nickname_key=lower(selected) and user_id is distinct from auth.uid());
end $$;
revoke all on function public.member_nickname_available(text) from public,anon,authenticated;
grant execute on function public.member_nickname_available(text) to anon,authenticated;

create function public.save_member_registration_v2(p_nickname text,p_profile jsonb,p_languages jsonb,p_consent_version text,p_terms_version text,p_privacy_version text,p_terms_accepted boolean,p_collection_accepted boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); policy public.member_registration_policies; selected text:=btrim(normalize(p_nickname,NFKC));birth date;existing public.board_aliases;result uuid;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501';end if;
 select * into policy from public.member_registration_policies where enabled and collection_version=p_consent_version for share;
 if not found or public.member_registration_v2_ready() is null or p_terms_version is distinct from policy.terms_version or p_privacy_version is distinct from policy.privacy_version or
    p_terms_accepted is distinct from true or (policy.collection_basis='consent' and p_collection_accepted is distinct from true) then raise exception 'Current policy acceptance required' using errcode='42501';end if;
 if not public.member_nickname_valid(selected) then raise exception 'Invalid nickname' using errcode='23514';end if;
 if jsonb_typeof(p_profile) is distinct from 'object' or coalesce(p_profile->>'birth_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Birth date required' using errcode='23514';end if;
 begin birth:=(p_profile->>'birth_date')::date;exception when others then raise exception 'Invalid birth date' using errcode='23514';end;
 if birth<date '0001-01-01' or birth>((now() at time zone 'Asia/Seoul')::date-interval '19 years')::date then raise exception 'Must be at least 19' using errcode='23514';end if;
 -- Use the legacy profile writer's advisory lock key to avoid lock inversions.
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select * into existing from public.board_aliases where user_id=uid for update;
 if found and existing.nickname_chosen and existing.nickname is distinct from selected then raise exception 'Nickname changes are not supported' using errcode='42501';end if;
 if exists(select 1 from public.board_aliases where nickname_key=lower(selected) and user_id<>uid) then raise exception 'Nickname unavailable' using errcode='23505';end if;
 insert into public.board_aliases(user_id,nickname,nickname_chosen) values(uid,selected,true)
 on conflict(user_id) do update set nickname=excluded.nickname,nickname_chosen=true;
 -- Existing profile/language checks and trusted auth.uid() ownership are reused.
 -- Signup retries must not replace an existing profile or erase its optional
 -- fields/languages with the current required-only form. First creation remains
 -- atomic; a failed first save rolls back the alias and acceptance as well.
 if exists(select 1 from public.member_profiles where user_id=uid) then result:=uid;
 else result:=public.save_member_profile(p_profile,p_languages,p_consent_version);end if;
 if result is distinct from uid then raise exception 'Unverified profile result';end if;
 insert into public.member_policy_acceptances(user_id,collection_version,terms_accepted,collection_accepted)
 values(uid,policy.collection_version,true,case when policy.collection_basis='consent' then true else false end)
 on conflict(user_id,collection_version) do nothing;
 return uid;
end $$;
revoke all on function public.save_member_registration_v2(text,jsonb,jsonb,text,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.save_member_registration_v2(text,jsonb,jsonb,text,text,text,boolean,boolean) to authenticated;
-- Prevent direct bypass of nickname/age/acceptance checks when registration is
-- eventually approved. Confirm there are no other callers before manual apply.
revoke execute on function public.save_member_profile(jsonb,jsonb,text) from public,anon,authenticated;

-- Intentionally insert NO policy, replace NO legacy readiness function, and enable
-- NO signup flag. Publication, retention, email/Auth settings and legacy readiness
-- need a separately reviewed activation. Existing board aliases/snapshots stay intact.
commit;
