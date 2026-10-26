-- MANUAL candidate: apply only with explicit approval and reviewed prerequisites.
-- Auth users without this app's one-use reference are unaffected.
begin;
create table public.member_signup_requests(
 token uuid primary key default gen_random_uuid(),
 email text not null check(email=lower(btrim(email)) and length(email) between 3 and 254),
 nickname text not null,profile jsonb not null,languages jsonb not null,
 collection_version text not null references public.member_registration_policies(collection_version),
 terms_version text not null,privacy_version text not null,
 terms_accepted boolean not null check(terms_accepted),collection_accepted boolean not null,
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default (clock_timestamp()+interval '1 hour')
);
create index member_signup_request_expiry on public.member_signup_requests(expires_at);
create index member_signup_request_email on public.member_signup_requests(email,created_at);
alter table public.member_signup_requests enable row level security;
alter table public.member_signup_requests force row level security;
revoke all on public.member_signup_requests from public,anon,authenticated;

create function public.prepare_member_registration(p_email text,p_nickname text,p_profile jsonb,p_languages jsonb,p_consent_version text,p_terms_version text,p_privacy_version text,p_terms_accepted boolean,p_collection_accepted boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare selected_email text:=lower(btrim(p_email));policy public.member_registration_policies;birth date;result uuid;
begin
 if selected_email is null or length(selected_email)>254 or selected_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid registration request' using errcode='23514';end if;
 select * into policy from public.member_registration_policies where enabled and collection_version=p_consent_version for share;
 if not found or public.member_registration_v2_ready() is null or p_terms_version is distinct from policy.terms_version or p_privacy_version is distinct from policy.privacy_version or p_terms_accepted is distinct from true or (policy.collection_basis='consent' and p_collection_accepted is distinct from true) then raise exception 'Policy acceptance required' using errcode='42501';end if;
 if not public.member_nickname_valid(btrim(normalize(p_nickname,NFKC))) or jsonb_typeof(p_profile) is distinct from 'object' or jsonb_typeof(p_languages) is distinct from 'array' or jsonb_array_length(p_languages)>3 then raise exception 'Invalid registration request' using errcode='23514';end if;
 if length(p_profile::text)>4000 or length(p_languages::text)>2000 or exists(select 1 from jsonb_object_keys(p_profile) k where k not in ('name','phone_country_code','phone_number','nationality_code','gender','birth_date','korean_proficiency','english_proficiency')) then raise exception 'Unexpected profile field' using errcode='22023';end if;
 if coalesce(p_profile->>'birth_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Birth date required' using errcode='23514';end if;
 begin birth:=(p_profile->>'birth_date')::date;exception when others then raise exception 'Invalid birth date' using errcode='23514';end;
 if birth<date '0001-01-01' or birth>((now() at time zone 'Asia/Seoul')::date-interval '19 years')::date or
    coalesce(p_profile->>'korean_proficiency','') not in ('none','basic','conversational','fluent','native') or
    coalesce(p_profile->>'english_proficiency','') not in ('none','basic','conversational','fluent','native') then raise exception 'Invalid eligibility or proficiency' using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended(selected_email,20261023));
 -- Expired temporary requests only; no Auth/profile/community/event data is deleted.
 delete from public.member_signup_requests where expires_at<clock_timestamp();
 if (select count(*) from public.member_signup_requests where email=selected_email and created_at>clock_timestamp()-interval '1 minute')>=5 then raise exception 'Rate limited' using errcode='P0003';end if;
 insert into public.member_signup_requests(email,nickname,profile,languages,collection_version,terms_version,privacy_version,terms_accepted,collection_accepted)
 values(selected_email,p_nickname,p_profile,p_languages,p_consent_version,p_terms_version,p_privacy_version,true,coalesce(p_collection_accepted,false)) returning token into result;
 return result;
end $$;
revoke all on function public.prepare_member_registration(text,text,jsonb,jsonb,text,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.prepare_member_registration(text,text,jsonb,jsonb,text,text,text,boolean,boolean) to anon,authenticated;

create function public.member_signup_auth_profile() returns trigger language plpgsql security definer set search_path='' as $$
declare request public.member_signup_requests;reference text:=new.raw_user_meta_data->>'malmoim_registration_token';prior_sub text:=current_setting('request.jwt.claim.sub',true);result uuid;
begin
 if reference is null then return new;end if;
 if reference !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Invalid registration request' using errcode='23514';end if;
 select * into request from public.member_signup_requests where token=reference::uuid and expires_at>clock_timestamp() and email=lower(btrim(new.email)) for update;
 if not found then raise exception 'Invalid registration request' using errcode='23514';end if;
 -- Scope impersonation strictly to the trusted just-inserted Auth UUID, restore
 -- the previous claim before returning. The trigger is not callable as an RPC.
 perform set_config('request.jwt.claim.sub',new.id::text,true);
 result:=public.save_member_registration_v2(request.nickname,request.profile,request.languages,request.collection_version,request.terms_version,request.privacy_version,request.terms_accepted,request.collection_accepted);
 perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);
 if result is distinct from new.id then raise exception 'Registration did not complete';end if;
 delete from public.member_signup_requests where token=request.token;
 return new;
end $$;
revoke all on function public.member_signup_auth_profile() from public,anon,authenticated;
create trigger member_signup_auth_profile after insert on auth.users for each row execute function public.member_signup_auth_profile();
notify pgrst,'reload schema';
commit;
