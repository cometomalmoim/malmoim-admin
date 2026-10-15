-- Stage 2 only: apply after 010_applicant_management.sql, subject to separate approval.
-- Independent of 012_event_fee_settings.sql and the excluded payment/refund draft.
-- No seed, backfill, fee changes, refund tables or refund RPCs.
-- Confirmation rules: entering paid records auth.uid()/server time; paid -> paid
-- preserves even unknown legacy metadata; leaving paid clears current metadata.
-- Existing status changes remain in event_application_audit (actor/server time).
-- Existing RLS, grants, revision checks, contact checks and event locks are preserved.
begin;

alter table public.event_application_management
  add column if not exists payment_confirmed_by uuid references auth.users(id),
  add column if not exists payment_confirmed_at timestamptz;
alter table public.event_application_management
  drop constraint if exists event_application_management_payment_status_check;
alter table public.event_application_management
  add constraint event_application_management_payment_status_check
    check (payment_status in ('unknown','unpaid','pending_confirmation','paid','refunded'));

create or replace view public.event_application_list with (security_invoker=true) as
with responses as (
  select id,event_id,name,contact,contact_type,preferred_class,status,created_at,
    null::text participation_history,null::text history_detail,'season9'::text source,
    extract(year from date_of_birth)::integer birth_year,nationality,null::text source_note
  from public.event_applications
  union all
  select id,event_id,name,contact,'phone',null,status,created_at,participation_history,
    history_detail,'registration',null,null,null
  from public.event_registration_responses
  union all
  select id,event_id,name,contact,contact_type,null,'received',created_at,null,null,
    'manual',null,null,source_note
  from public.event_manual_applications
)
select b.id,b.event_id,b.name,b.contact,b.contact_type,b.preferred_class,
  coalesce(m.status,b.status) status,b.created_at,b.participation_history,b.history_detail,b.source,
  case when m.application_id is not null then m.birth_year else b.birth_year end birth_year,
  case when m.application_id is not null then m.nationality else b.nationality end nationality,
  coalesce(m.payment_status,'unknown') payment_status,coalesce(m.internal_note,'') internal_note,
  coalesce(m.revision,0) revision,b.source_note,
  m.payment_confirmed_by,m.payment_confirmed_at
from responses b
left join public.event_application_management m
  on m.source=b.source and m.application_id=b.id and m.event_id=b.event_id;

-- Replace the existing RPC without changing its signature, preserving callers.
create or replace function public.manage_event_application(
  p_slug text,p_source text,p_id uuid,p_revision integer,p_name text,p_contact text,
  p_contact_type text,p_birth_year integer,p_nationality text,p_status text,
  p_payment text,p_note text,p_source_note text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  e public.recruitment_events;
  previous public.event_application_list;
  normalized text;
  v_application_id uuid:=p_id;
  v_confirmed_by uuid;
  v_confirmed_at timestamptz;
  v_action text;
begin
  if not exists(select 1 from public.admin_users where user_id=auth.uid()) then
    return jsonb_build_object('code','forbidden');
  end if;
  if p_source is null or p_source not in ('manual','registration','season9') then
    return jsonb_build_object('code','invalid');
  end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 100
    or p_contact is null or length(btrim(p_contact)) not between 1 and 200
    or p_contact_type is null or p_contact_type not in ('phone','instagram')
    or p_status is null or p_status not in ('received','reviewing','accepted','waitlisted','declined','withdrawn')
    or p_payment is null or p_payment not in ('unknown','unpaid','pending_confirmation','paid','refunded')
    or p_note is null or length(p_note)>3000 or length(p_nationality)>100
    or (p_birth_year is not null and (p_birth_year<1900 or p_birth_year>extract(year from current_date))) then
    return jsonb_build_object('code','invalid');
  end if;
  normalized:=public.event_contact_key(p_contact,p_contact_type);
  if normalized is null or normalized='' then return jsonb_build_object('code','invalid'); end if;
  select * into e from public.recruitment_events where slug=p_slug for update;
  if not found then return jsonb_build_object('code','missing'); end if;
  if p_id is not null then
    select * into previous from public.event_application_list
      where event_id=e.id and id=p_id and source=p_source;
    if not found then return jsonb_build_object('code','missing'); end if;
    if p_revision is distinct from previous.revision then return jsonb_build_object('code','conflict'); end if;
    if p_source='registration' and p_contact_type<>'phone' then return jsonb_build_object('code','invalid'); end if;
  else
    if p_source<>'manual' or p_source_note is null
      or length(btrim(p_source_note)) not between 1 and 1000 then
      return jsonb_build_object('code','invalid');
    end if;
  end if;
  if exists(select 1 from public.event_application_list a
    where a.event_id=e.id and a.contact_type=p_contact_type
      and public.event_contact_key(a.contact,a.contact_type)=normalized
      and (p_id is null or a.id<>p_id or a.source<>p_source)) then
    return jsonb_build_object('code','duplicate');
  end if;
  if p_id is null then
    insert into public.event_manual_applications(event_id,name,contact,contact_type,source_note)
      values(e.id,btrim(p_name),normalized,p_contact_type,btrim(p_source_note))
      returning id into v_application_id;
  elsif p_source='manual' then
    if p_source_note is null or length(btrim(p_source_note)) not between 1 and 1000 then
      return jsonb_build_object('code','invalid');
    end if;
    update public.event_manual_applications set name=btrim(p_name),contact=normalized,
      contact_type=p_contact_type,source_note=btrim(p_source_note) where id=p_id and event_id=e.id;
  elsif p_source='registration' then
    update public.event_registration_responses set name=btrim(p_name),contact=normalized where id=p_id and event_id=e.id;
  elsif p_source='season9' then
    update public.event_applications set name=btrim(p_name),contact=normalized,contact_type=p_contact_type where id=p_id and event_id=e.id;
  else
    return jsonb_build_object('code','invalid');
  end if;

  if p_payment='paid' then
    if previous.payment_status='paid' then
      v_confirmed_by:=previous.payment_confirmed_by;
      v_confirmed_at:=previous.payment_confirmed_at;
    else
      v_confirmed_by:=auth.uid();
      v_confirmed_at:=clock_timestamp();
    end if;
  end if;
  v_action:=case when p_id is null then 'manual_create'
    when previous.payment_status is distinct from p_payment then 'payment_status_update'
    else 'update' end;
  insert into public.event_application_management(
    source,application_id,event_id,birth_year,nationality,internal_note,status,payment_status,
    payment_confirmed_by,payment_confirmed_at,revision,updated_by
  ) values(
    p_source,v_application_id,e.id,p_birth_year,nullif(btrim(p_nationality),''),p_note,p_status,p_payment,
    v_confirmed_by,v_confirmed_at,coalesce(previous.revision,0)+1,auth.uid()
  ) on conflict(source,application_id) do update set
    birth_year=excluded.birth_year,nationality=excluded.nationality,internal_note=excluded.internal_note,
    status=excluded.status,payment_status=excluded.payment_status,
    payment_confirmed_by=excluded.payment_confirmed_by,payment_confirmed_at=excluded.payment_confirmed_at,
    revision=excluded.revision,updated_at=clock_timestamp(),updated_by=excluded.updated_by;
  insert into public.event_application_audit(
    event_id,source,application_id,actor,action,old_status,new_status,old_payment,new_payment
  ) values(
    e.id,p_source,v_application_id,auth.uid(),v_action,previous.status,p_status,
    previous.payment_status,p_payment
  );
  return jsonb_build_object('code','saved','id',v_application_id,'revision',coalesce(previous.revision,0)+1);
end $$;
revoke all on function public.manage_event_application(text,text,uuid,integer,text,text,text,integer,text,text,text,text,text) from public,anon;
grant execute on function public.manage_event_application(text,text,uuid,integer,text,text,text,integer,text,text,text,text,text) to authenticated;

commit;
