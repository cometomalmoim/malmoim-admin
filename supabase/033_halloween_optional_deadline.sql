-- Review after existing event registration migrations. Does not enable intake.
-- Halloween only: allow no closing timestamp, controlled by applications_open/registration_enabled.
begin;
alter table public.recruitment_events drop constraint event_draft_period_required;
alter table public.recruitment_events add constraint event_draft_period_required check (
 (status='draft' and not applications_open) or
 (opens_at is not null and closes_at is not null and opens_at<closes_at) or
 (slug='halloween-2026' and opens_at is not null and closes_at is null)
);
create or replace function public.event_registration_info(p_slug text,p_test boolean default false) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare e public.recruitment_events; is_admin boolean;
begin
 select exists(select 1 from public.admin_users where user_id=auth.uid()) into is_admin;
 select * into e from public.recruitment_events where slug=p_slug;
 if not found then return jsonb_build_object('open',false); end if;
 if p_test then
   if not is_admin or not e.is_test then return jsonb_build_object('open',false); end if;
   return jsonb_build_object('open',true,'notice','가상 데이터만 입력하는 관리자 테스트입니다. 실제 개인정보를 입력하지 마세요.','version','synthetic-test-v1','marketingNotice','가상 데이터 테스트용 선택 동의입니다.');
 end if;
 if e.slug <> 'halloween-2026' or e.is_test or not e.registration_enabled or not e.applications_open or e.status <> 'published'
 or e.is_archived or e.opens_at is null or clock_timestamp()<e.opens_at or (e.closes_at is not null and clock_timestamp()>=e.closes_at)
 or nullif(btrim(e.privacy_notice),'') is null or nullif(btrim(e.privacy_notice_version),'') is null then
 return jsonb_build_object('open',false); end if;
 return jsonb_build_object('open',true,'notice',e.privacy_notice,'version',e.privacy_notice_version,'marketingNotice',e.marketing_notice);
end $$;

commit;
