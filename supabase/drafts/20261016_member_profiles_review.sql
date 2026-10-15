-- REVIEW DRAFT ONLY. Never run against production without DB-owner review.
-- Check remote objects/history first. No IF NOT EXISTS: collisions must fail.
-- This draft deliberately cannot enable registration: consent persistence is pending.
-- If any prior draft/schema exists, review a separate data-preserving migration.
-- Never truncate existing languages or default an unanswered English level to none.
-- Apply as a migration owner with BYPASSRLS (normally postgres in Supabase).
begin;

create table public.member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Required/optional collection policy is not approved: nullable draft fields.
  name text check (name is null or (length(btrim(name)) between 1 and 100 and name !~ '[[:cntrl:]]')),
  phone_country_code text check (phone_country_code ~ '^[1-9][0-9]{0,2}$'),
  phone_number text check (phone_number ~ '^[0-9]{4,14}$'),
  nationality_code text check (nationality_code in ('AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ','BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ','CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ','DE','DJ','DK','DM','DO','DZ','EC','EE','EG','EH','ER','ES','ET','FI','FJ','FK','FM','FO','FR','GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY','HK','HM','HN','HR','HT','HU','ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT','JE','JM','JO','JP','KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ','LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY','MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ','NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ','OM','PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY','QA','RE','RO','RS','RU','RW','SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ','TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ','UA','UG','UM','US','UY','UZ','VA','VC','VE','VG','VI','VN','VU','WF','WS','YE','YT','ZA','ZM','ZW')),
  gender text check (gender in ('female','male','undisclosed')),
  birth_date date check (birth_date >= date '0001-01-01'),
  korean_proficiency text not null check (korean_proficiency in ('none','basic','conversational','fluent','native')),
  english_proficiency text not null check (english_proficiency in ('none','basic','conversational','fluent','native')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_phone_pair check (
    (phone_country_code is null and phone_number is null) or
    (phone_country_code is not null and phone_number is not null and
     length(phone_country_code || phone_number) between 7 and 15)
  )
);
create table public.member_languages (
  user_id uuid not null references public.member_profiles(user_id) on delete cascade,
  language_code text not null check (language_code in ('ja','zh','es','fr','de','it','pt','ru','ar','vi','th','id','ms','tl','hi','bn','ur','ne','mn','uz','tr','uk','pl','nl','sv','fi','da','no','el','he','fa','sw','my','km','lo')),
  proficiency text not null check (proficiency in ('basic','conversational','fluent','native')),
  primary key (user_id, language_code)
);
comment on column public.member_profiles.phone_number is
  'Digits only, no country code. No verification claim. KR input drops one leading trunk zero.';
comment on table public.member_languages is
  'Curated 35 ISO 639-1 additional languages excluding ko and en. Expand UI/server/DB together after review.';

alter table public.member_profiles enable row level security;
alter table public.member_profiles force row level security;
alter table public.member_languages enable row level security;
alter table public.member_languages force row level security;
revoke all on public.member_profiles, public.member_languages from public, anon, authenticated;
grant select on public.member_profiles, public.member_languages to authenticated;
create policy "Members read own profile" on public.member_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Members read own languages" on public.member_languages
  for select to authenticated using ((select auth.uid()) = user_id);
-- INSERT/UPDATE/DELETE are deliberately not granted and have no direct-write policy.
-- All writes go through the narrow RPC below; callers cannot choose an owner UUID
-- or change created_at/updated_at. No admin_users exception in either SELECT policy.

create function public.member_profile_protect() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.user_id is distinct from old.user_id or
                          new.created_at is distinct from old.created_at) then
    raise exception 'Protected member columns cannot change' using errcode = '23514';
  end if;
  if new.birth_date > (current_timestamp at time zone 'Asia/Seoul')::date then
    raise exception 'Birth date cannot be in the future' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then new.created_at := transaction_timestamp(); end if;
  new.updated_at := transaction_timestamp();
  return new;
end;
$$;
revoke all on function public.member_profile_protect() from public, anon, authenticated;
create trigger member_profile_protect before insert or update on public.member_profiles
  for each row execute function public.member_profile_protect();

-- Deferred checks permit atomic replacement of all language rows, but no committed
-- profile may have more than three additional languages. RPC locks the profile before replacement.
create function public.member_language_count_check() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
  total integer;
begin
  target := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  if exists(select 1 from public.member_profiles where user_id = target) then
    perform 1 from public.member_profiles where user_id = target for update;
    select count(*) into total from public.member_languages where user_id = target;
    if total not between 0 and 3 then
      raise exception 'Member may have 0 to 3 additional languages' using errcode = '23514';
    end if;
  end if;
  -- Additional-language ownership cannot be moved between members.
  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id and
     exists(select 1 from public.member_profiles where user_id = old.user_id) then
    raise exception 'Language ownership cannot change' using errcode = '23514';
  end if;
  return null;
end;
$$;
revoke all on function public.member_language_count_check() from public, anon, authenticated;
create constraint trigger member_profile_language_count
  after insert or update on public.member_profiles
  deferrable initially deferred for each row execute function public.member_language_count_check();
create constraint trigger member_language_count
  after insert or update or delete on public.member_languages
  deferrable initially deferred for each row execute function public.member_language_count_check();

-- No policy text/version is fabricated. DB owner must add approved, immutable
-- consent recording and required-field rules BEFORE replacing this null response.
create function public.member_registration_ready() returns text
language sql stable security invoker set search_path = '' as $$ select null::text $$;
revoke all on function public.member_registration_ready() from public, anon, authenticated;
grant execute on function public.member_registration_ready() to anon, authenticated;

create function public.save_member_profile(p_profile jsonb, p_languages jsonb, p_consent_version text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  approved_version text := public.member_registration_ready();
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if approved_version is null or p_consent_version is distinct from approved_version then
    raise exception 'Registration policy is not ready' using errcode = '42501';
  end if;
  if jsonb_typeof(p_profile) is distinct from 'object' or
     jsonb_typeof(p_languages) is distinct from 'array' then
    raise exception 'Invalid profile payload' using errcode = '22023';
  end if;
  if jsonb_array_length(p_languages) not between 0 and 3 then
    raise exception 'Expected 0 to 3 additional languages' using errcode = '23514';
  end if;
  if exists (select 1 from jsonb_object_keys(p_profile) k
             where k not in ('name','phone_country_code','phone_number','nationality_code',
                             'gender','birth_date','korean_proficiency','english_proficiency')) then
    raise exception 'Unexpected profile field' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_languages) entry
             where jsonb_typeof(entry) is distinct from 'object'
                or jsonb_typeof(entry->'language_code') is distinct from 'string'
                or jsonb_typeof(entry->'proficiency') is distinct from 'string') then
    raise exception 'Invalid language entry' using errcode = '22023';
  end if;
  -- Serializes first creation and later saves for this Auth UUID. Collisions only
  -- add contention; they cannot grant access. Existing profile also gets row lock.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller::text, 0));
  insert into public.member_profiles (
    user_id,name,phone_country_code,phone_number,nationality_code,gender,birth_date,korean_proficiency,english_proficiency
  ) values (
    caller,p_profile->>'name',p_profile->>'phone_country_code',p_profile->>'phone_number',
    p_profile->>'nationality_code',p_profile->>'gender',(p_profile->>'birth_date')::date,
    p_profile->>'korean_proficiency',p_profile->>'english_proficiency'
  )
  on conflict (user_id) do update set
    name=excluded.name,phone_country_code=excluded.phone_country_code,phone_number=excluded.phone_number,
    nationality_code=excluded.nationality_code,gender=excluded.gender,birth_date=excluded.birth_date,
    korean_proficiency=excluded.korean_proficiency,english_proficiency=excluded.english_proficiency;
  perform 1 from public.member_profiles where user_id = caller for update;
  delete from public.member_languages where user_id = caller;
  insert into public.member_languages(user_id,language_code,proficiency)
    select caller,entry->>'language_code',entry->>'proficiency'
    from jsonb_array_elements(p_languages) entry;
  -- Before activation: insert approved consent acceptance here in the SAME transaction.
  -- Version/time come from server policy/database clock. Never accept a client timestamp.
  return caller;
end;
$$;
revoke all on function public.save_member_profile(jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.save_member_profile(jsonb,jsonb,text) to authenticated;
commit;
