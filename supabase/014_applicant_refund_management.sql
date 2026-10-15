-- Stage 3 only, after 010 and 013. Existing 011 participation definitions remain unchanged. Do not execute the excluded 011 mixed draft.
-- No backfill and no money transfer. All timestamps/actors are server-generated
-- except the administrator-entered request date. One completed refund per applicant.
begin;

create table public.event_application_refunds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.recruitment_events(id),
  source text not null check (source in ('season9','registration','manual')),
  application_id uuid not null,
  reason text not null check (char_length(btrim(reason)) between 1 and 2000),
  requested_at timestamptz not null,
  status text not null default 'requested'
    check (status in ('requested','approved','rejected','processed')),
  decision_by uuid references auth.users(id),
  decision_at timestamptz,
  processed_amount_krw integer check (processed_amount_krw is null or processed_amount_krw>=0),
  processed_by uuid references auth.users(id),
  processed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_application_refunds_state_shape check (
    (status='requested' and decision_by is null and decision_at is null
      and processed_amount_krw is null and processed_by is null and processed_at is null)
    or (status in ('approved','rejected') and decision_by is not null and decision_at is not null
      and processed_amount_krw is null and processed_by is null and processed_at is null)
    or (status='processed' and decision_by is not null and decision_at is not null
      and processed_amount_krw is not null and processed_by is not null and processed_at is not null)
  )
);
create index event_application_refunds_application_idx
  on public.event_application_refunds(event_id,source,application_id,requested_at desc,id desc);
create unique index event_application_refunds_one_open_per_applicant_idx
  on public.event_application_refunds(event_id,source,application_id)
  where status in ('requested','approved');

alter table public.event_application_refunds enable row level security;
alter table public.event_application_refunds force row level security;
revoke all on public.event_application_refunds from public,anon,authenticated;
grant select on public.event_application_refunds to authenticated;
create policy "Administrators read event application refunds"
  on public.event_application_refunds for select to authenticated
  using (exists(select 1 from public.admin_users where user_id=(select auth.uid())));


-- A completed record cannot be entered through ordinary applicant edits.
-- A legacy refunded row may retain its state and accept normal profile edits.
create function public.guard_applicant_refund_payment() returns trigger
language plpgsql security definer set search_path='' as $$
declare prior_payment text;
begin
 -- The existing save RPC uses INSERT ... ON CONFLICT, so handle both trigger paths.
 if TG_OP='UPDATE' then prior_payment:=old.payment_status;
 else
  select payment_status into prior_payment from public.event_application_management
   where source=new.source and application_id=new.application_id and event_id=new.event_id;
 end if;
 if prior_payment='refunded' then
  if new.payment_status is distinct from prior_payment then
   raise exception 'Refunded payment status is locked' using errcode='23514';
  end if;
 elsif new.payment_status='refunded' then
  if prior_payment is distinct from 'paid' or not exists (
   select 1 from public.event_application_refunds r where r.event_id=new.event_id
    and r.source=new.source and r.application_id=new.application_id and r.status='processed'
  ) then raise exception 'Use refund completion to change payment status' using errcode='23514'; end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_applicant_refund_payment() from public,anon,authenticated;
create trigger guard_applicant_refund_payment before insert or update
 on public.event_application_management for each row execute function public.guard_applicant_refund_payment();

create unique index event_application_refunds_one_processed_idx
 on public.event_application_refunds(event_id,source,application_id) where status='processed';
-- Link the existing append-only audit trail to the refund record, without changing old entries.
alter table public.event_application_audit add column refund_id uuid references public.event_application_refunds(id);

create function public.create_event_refund_request(
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

create function public.update_event_refund(
 p_slug text,p_refund_id uuid,p_action text,p_processed_amount_krw integer default null,
 p_transfer_confirmed boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.recruitment_events; r public.event_application_refunds; payment text; target text;
begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid()) then return jsonb_build_object('code','forbidden'); end if;
 if p_action is null or p_action not in ('approve','reject','process') or p_refund_id is null
 then return jsonb_build_object('code','invalid'); end if;
 select * into e from public.recruitment_events where slug=p_slug for update;
 if not found then return jsonb_build_object('code','missing'); end if;
 select * into r from public.event_application_refunds where id=p_refund_id and event_id=e.id for update;
 if not found then return jsonb_build_object('code','missing'); end if;
 select payment_status into payment from public.event_application_management
 where event_id=e.id and source=r.source and application_id=r.application_id for update;
 if not found then return jsonb_build_object('code','missing'); end if;
 if p_action in ('approve','reject') then
  if r.status<>'requested' or p_processed_amount_krw is not null
  then return jsonb_build_object('code','invalid_transition'); end if;
  target:=case when p_action='approve' then 'approved' else 'rejected' end;
  update public.event_application_refunds set status=target,decision_by=auth.uid(),decision_at=clock_timestamp(),updated_at=clock_timestamp() where id=r.id;
 else
  if r.status<>'approved' then return jsonb_build_object('code','invalid_transition'); end if;
  if p_processed_amount_krw is null or p_processed_amount_krw<0 or p_transfer_confirmed is distinct from true
  then return jsonb_build_object('code','invalid'); end if;
  if payment<>'paid' then return jsonb_build_object('code','payment_state_conflict'); end if;
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
