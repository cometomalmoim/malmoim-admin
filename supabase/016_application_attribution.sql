-- Additive attribution support. Does not enable intake or modify payment/refund/participation.
begin;
create table public.event_application_attribution(
 event_id uuid not null references public.recruitment_events(id),
 application_id uuid not null references public.event_registration_responses(id),
 utm_source text check(length(utm_source)<=150),utm_medium text check(length(utm_medium)<=150),utm_campaign text check(length(utm_campaign)<=150),
 created_at timestamptz not null default now(),primary key(event_id,application_id)
);
alter table public.event_application_attribution enable row level security;
alter table public.event_application_attribution force row level security;
revoke all on public.event_application_attribution from public,anon,authenticated;
grant select on public.event_application_attribution to authenticated;
create policy attribution_admin_read on public.event_application_attribution for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create view public.event_application_traffic_list with(security_invoker=true) as
 select b.*,case when b.source='season9' then s.utm_source else a.utm_source end utm_source,
 case when b.source='season9' then s.utm_medium else a.utm_medium end utm_medium,
 case when b.source='season9' then s.utm_campaign else a.utm_campaign end utm_campaign
 from public.event_application_list b
 left join public.event_application_attribution a on b.source='registration' and a.event_id=b.event_id and a.application_id=b.id
 left join public.event_applications s on b.source='season9' and s.event_id=b.event_id and s.id=b.id;
revoke all on public.event_application_traffic_list from public,anon;
grant select on public.event_application_traffic_list to authenticated;
create function public.submit_event_registration_attributed(p_slug text,p_submission uuid,p_name text,p_contact text,p_history text,p_detail text,p_consent boolean,p_version text,p_test boolean,p_marketing boolean,p_utm_source text,p_utm_medium text,p_utm_campaign text) returns text
 language plpgsql security definer set search_path='' as $$
declare result text; r public.event_registration_responses;
begin
 if length(coalesce(p_utm_source,''))>150 or length(coalesce(p_utm_medium,''))>150 or length(coalesce(p_utm_campaign,''))>150 then return 'invalid';end if;
 result:=public.submit_event_registration(p_slug,p_submission,p_name,p_contact,p_history,p_detail,p_consent,p_version,p_test,p_marketing);
 if result='saved' then
  select x.* into strict r from public.event_registration_responses x join public.recruitment_events e on e.id=x.event_id where e.slug=p_slug and x.submission_id=p_submission;
  -- Retry must not rewrite the original attribution. Save even empty attribution on first submission.
  insert into public.event_application_attribution(event_id,application_id,utm_source,utm_medium,utm_campaign)
  values(r.event_id,r.id,nullif(btrim(p_utm_source),''),nullif(btrim(p_utm_medium),''),nullif(btrim(p_utm_campaign),'')) on conflict do nothing;
 end if;
 return result;
end $$;
revoke all on function public.submit_event_registration_attributed(text,uuid,text,text,text,text,boolean,text,boolean,boolean,text,text,text) from public;
grant execute on function public.submit_event_registration_attributed(text,uuid,text,text,text,text,boolean,text,boolean,boolean,text,text,text) to anon,authenticated;
commit;
