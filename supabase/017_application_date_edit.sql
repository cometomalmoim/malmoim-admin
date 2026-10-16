-- Administrator date correction; preserve the original value in an immutable audit.
begin;
create table public.event_application_date_audit(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.recruitment_events(id),
 source text not null,application_id uuid not null,old_date timestamptz not null,new_date timestamptz not null,
 actor uuid not null,created_at timestamptz not null default now()
);
alter table public.event_application_date_audit enable row level security;
alter table public.event_application_date_audit force row level security;
revoke all on public.event_application_date_audit from public,anon,authenticated;
grant select on public.event_application_date_audit to authenticated;
create policy date_audit_admin_read on public.event_application_date_audit for select to authenticated
 using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create function public.correct_event_application_date(p_slug text,p_source text,p_id uuid,p_revision integer,p_date timestamptz)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.recruitment_events; a public.event_application_list; result jsonb;
begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid()) then return jsonb_build_object('code','forbidden');end if;
 if p_date is null or not isfinite(p_date) or p_date<'1900-01-01'::timestamptz or p_date>clock_timestamp()+interval '1 minute' then return jsonb_build_object('code','invalid');end if;
 select * into e from public.recruitment_events where slug=p_slug for update;
 if not found then return jsonb_build_object('code','missing');end if;
 select * into a from public.event_application_list where event_id=e.id and source=p_source and id=p_id;
 if not found then return jsonb_build_object('code','missing');end if;
 if p_revision is distinct from a.revision then return jsonb_build_object('code','conflict');end if;
 -- Reuse validation, optimistic revision increment and the existing status audit.
 result:=public.manage_event_application(p_slug,p_source,p_id,p_revision,a.name,a.contact,a.contact_type,a.birth_year,a.nationality,a.status,a.payment_status,a.internal_note,a.source_note);
 if result->>'code'<>'saved' then return result;end if;
 if p_source='registration' then update public.event_registration_responses set created_at=p_date where event_id=e.id and id=p_id;
 elsif p_source='manual' then update public.event_manual_applications set created_at=p_date where event_id=e.id and id=p_id;
 elsif p_source='season9' then update public.event_applications set created_at=p_date where event_id=e.id and id=p_id;
 end if;
 insert into public.event_application_date_audit(event_id,source,application_id,old_date,new_date,actor)
 values(e.id,p_source,p_id,a.created_at,p_date,auth.uid());
 return result;
end $$;
revoke all on function public.correct_event_application_date(text,text,uuid,integer,timestamptz) from public,anon;
grant execute on function public.correct_event_application_date(text,text,uuid,integer,timestamptz) to authenticated;
commit;
