-- Apply ONLY after 012,013,014 in a separately approved test/production plan.
-- Existing amounts remain NULL. Never infer actual receipts from event fees.
-- DB runtime validation remains incomplete: local initdb is sandbox-blocked.
begin;
alter table public.event_application_management
 add column paid_amount_krw integer check(paid_amount_krw>0),
 add column paid_amount_recorded_by uuid references auth.users(id),
 add column paid_amount_recorded_at timestamptz,
 add constraint actual_payment_record_shape check (
  (paid_amount_krw is null and paid_amount_recorded_by is null and paid_amount_recorded_at is null)
  or (paid_amount_krw is not null and paid_amount_recorded_by is not null and paid_amount_recorded_at is not null)
 );
alter table public.event_application_audit
 add column old_paid_amount_krw integer,
 add column new_paid_amount_krw integer;

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
  m.payment_confirmed_by,m.payment_confirmed_at,
  m.paid_amount_krw,m.paid_amount_recorded_by,m.paid_amount_recorded_at
from responses b
left join public.event_application_management m
  on m.source=b.source and m.application_id=b.id and m.event_id=b.event_id;

-- Separate monetary RPC: existing profile RPC cannot write receipt fields.
create function public.record_event_payment(
 p_slug text,p_source text,p_application_id uuid,p_revision integer,p_amount_krw integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.recruitment_events; m public.event_application_management;
begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid()) then return jsonb_build_object('code','forbidden'); end if;
 if p_source is null or p_source not in ('manual','registration','season9') or p_application_id is null
  or p_revision is null or p_revision<0 or p_amount_krw is null or p_amount_krw<=0
 then return jsonb_build_object('code','invalid'); end if;
 select * into e from public.recruitment_events where slug=p_slug for update;
 if not found then return jsonb_build_object('code','missing'); end if;
 select * into m from public.event_application_management
 where event_id=e.id and source=p_source and application_id=p_application_id for update;
 if not found then return jsonb_build_object('code','not_paid'); end if;
 if m.revision is distinct from p_revision then return jsonb_build_object('code','conflict'); end if;
 if m.payment_status<>'paid' then return jsonb_build_object('code','not_paid'); end if;
 if exists(select 1 from public.event_application_refunds where event_id=e.id and source=p_source
  and application_id=p_application_id and status in ('requested','approved','processed'))
 then return jsonb_build_object('code','payment_locked'); end if;
 if m.paid_amount_krw=p_amount_krw then return jsonb_build_object('code','saved'); end if;
 update public.event_application_management set paid_amount_krw=p_amount_krw,paid_amount_recorded_by=auth.uid(),
  paid_amount_recorded_at=clock_timestamp(),revision=revision+1,updated_by=auth.uid(),updated_at=clock_timestamp()
 where event_id=e.id and source=p_source and application_id=p_application_id;
 insert into public.event_application_audit(event_id,source,application_id,actor,action,old_payment,new_payment,old_paid_amount_krw,new_paid_amount_krw)
 values(e.id,p_source,p_application_id,auth.uid(),'payment_amount_recorded',m.payment_status,m.payment_status,m.paid_amount_krw,p_amount_krw);
 return jsonb_build_object('code','saved');
end $$;
revoke all on function public.record_event_payment(text,text,uuid,integer,integer) from public,anon;
grant execute on function public.record_event_payment(text,text,uuid,integer,integer) to authenticated;

-- Preserve profile edits, but do not let ordinary state edits contradict a recorded receipt.
create function public.guard_recorded_payment_status() returns trigger
language plpgsql security definer set search_path='' as $$
declare prior public.event_application_management;
begin
 if TG_OP='UPDATE' then prior:=old;
 else select * into prior from public.event_application_management where source=new.source and application_id=new.application_id and event_id=new.event_id;
 end if;
 if prior.payment_status='paid' and prior.paid_amount_krw is not null and new.payment_status not in ('paid','refunded')
 then raise exception 'Recorded payment requires refund management' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function public.guard_recorded_payment_status() from public,anon,authenticated;
create trigger guard_recorded_payment_status before insert or update on public.event_application_management
 for each row execute function public.guard_recorded_payment_status();

create or replace function public.create_event_refund_request(
 p_slug text,p_source text,p_application_id uuid,p_reason text,p_requested_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.recruitment_events; a public.event_application_list; refund_id uuid;
begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid()) then return jsonb_build_object('code','forbidden'); end if;
 if p_source is null or p_source not in ('season9','registration','manual') or p_application_id is null
  or p_reason is null or length(btrim(p_reason)) not between 1 and 2000
  or p_requested_at is null or not isfinite(p_requested_at) or p_requested_at>clock_timestamp()
 then return jsonb_build_object('code','invalid'); end if;
 select * into e from public.recruitment_events where slug=p_slug for update;
 if not found then return jsonb_build_object('code','missing'); end if;
 select * into a from public.event_application_list where event_id=e.id and source=p_source and id=p_application_id;
 if not found then return jsonb_build_object('code','missing'); end if;
 if a.payment_status<>'paid' then return jsonb_build_object('code','not_paid'); end if;
 if a.paid_amount_krw is null or a.paid_amount_krw<=0 then return jsonb_build_object('code','payment_amount_unknown'); end if;
 if exists(select 1 from public.event_application_refunds where event_id=e.id and source=p_source
   and application_id=p_application_id and status in ('requested','approved','processed'))
 then return jsonb_build_object('code','duplicate'); end if;
 insert into public.event_application_refunds(event_id,source,application_id,reason,requested_at,created_by)
 values(e.id,p_source,p_application_id,btrim(p_reason),p_requested_at,auth.uid()) returning id into refund_id;
 insert into public.event_application_audit(event_id,source,application_id,actor,action,old_payment,new_payment,refund_id)
 values(e.id,p_source,p_application_id,auth.uid(),'refund_requested',a.payment_status,a.payment_status,refund_id);
 return jsonb_build_object('code','saved');
end $$;
revoke all on function public.create_event_refund_request(text,text,uuid,text,timestamptz) from public,anon;
grant execute on function public.create_event_refund_request(text,text,uuid,text,timestamptz) to authenticated;

create or replace function public.update_event_refund(
 p_slug text,p_refund_id uuid,p_action text,p_processed_amount_krw integer default null,
 p_transfer_confirmed boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.recruitment_events; r public.event_application_refunds; payment text; actual_amount integer; target text;
begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid()) then return jsonb_build_object('code','forbidden'); end if;
 if p_action is null or p_action not in ('approve','reject','process') or p_refund_id is null
 then return jsonb_build_object('code','invalid'); end if;
 select * into e from public.recruitment_events where slug=p_slug for update;
 if not found then return jsonb_build_object('code','missing'); end if;
 select * into r from public.event_application_refunds where id=p_refund_id and event_id=e.id for update;
 if not found then return jsonb_build_object('code','missing'); end if;
 select payment_status,paid_amount_krw into payment,actual_amount from public.event_application_management
 where event_id=e.id and source=r.source and application_id=r.application_id for update;
 if not found then return jsonb_build_object('code','missing'); end if;
 if p_action in ('approve','reject') then
  if r.status<>'requested' or p_processed_amount_krw is not null
  then return jsonb_build_object('code','invalid_transition'); end if;
  target:=case when p_action='approve' then 'approved' else 'rejected' end;
  update public.event_application_refunds set status=target,decision_by=auth.uid(),decision_at=clock_timestamp(),updated_at=clock_timestamp() where id=r.id;
 else
  if r.status<>'approved' then return jsonb_build_object('code','invalid_transition'); end if;
  if p_processed_amount_krw is null or p_processed_amount_krw<=0 or p_transfer_confirmed is distinct from true
  then return jsonb_build_object('code','invalid'); end if;
  if payment<>'paid' then return jsonb_build_object('code','payment_state_conflict'); end if;
  if actual_amount is null or actual_amount<=0 then return jsonb_build_object('code','payment_amount_unknown'); end if;
  if p_processed_amount_krw is distinct from actual_amount then return jsonb_build_object('code','amount_mismatch'); end if;
  if exists(select 1 from public.event_application_refunds where event_id=e.id and source=r.source and application_id=r.application_id and status='processed') then return jsonb_build_object('code','duplicate'); end if;
  target:='processed';
  update public.event_application_refunds set status=target,processed_amount_krw=p_processed_amount_krw,
   processed_by=auth.uid(),processed_at=clock_timestamp(),updated_at=clock_timestamp() where id=r.id;
  update public.event_application_management set payment_status='refunded',payment_confirmed_by=null,
   payment_confirmed_at=null,revision=revision+1,updated_by=auth.uid(),updated_at=clock_timestamp()
  where event_id=e.id and source=r.source and application_id=r.application_id;
 end if;
 insert into public.event_application_audit(event_id,source,application_id,actor,action,old_payment,new_payment,refund_id)
 values(e.id,r.source,r.application_id,auth.uid(),'refund_'||target,payment,case when target='processed' then 'refunded' else payment end,r.id);
 return jsonb_build_object('code','saved');
end $$;
revoke all on function public.update_event_refund(text,uuid,text,integer,boolean) from public,anon;
grant execute on function public.update_event_refund(text,uuid,text,integer,boolean) to authenticated;

commit;
