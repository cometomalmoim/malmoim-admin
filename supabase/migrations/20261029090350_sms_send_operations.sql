-- Additive metadata only. Does not approve, enqueue or send a message.
begin;
alter table public.sms_batches add column operation_id uuid;
create index sms_batches_operation_idx on public.sms_batches(operation_id) where operation_id is not null;
create schema if not exists sms_private;
revoke all on schema sms_private from public,anon;
grant usage on schema sms_private to authenticated;
create function sms_private.register_send_operation(p_operation uuid,p_batches uuid[]) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.sms_admin() then raise exception 'forbidden';end if;
 if p_operation is null or coalesce(cardinality(p_batches),0) not between 1 and 50 or (select count(distinct x) from unnest(p_batches) x)<>cardinality(p_batches) then raise exception 'invalid';end if;
 perform 1 from public.sms_batches where id=any(p_batches) order by id for update;
 if (select count(*) from public.sms_batches where id=any(p_batches) and created_by=auth.uid())<>cardinality(p_batches) then raise exception 'forbidden';end if;
 if exists(select 1 from public.sms_batches where operation_id=p_operation and not(id=any(p_batches))) then raise exception 'operation_reused';end if;
 if exists(select 1 from public.sms_batches where id=any(p_batches) and operation_id is not null and operation_id<>p_operation) then raise exception 'already_grouped';end if;
 if not exists(select 1 from public.sms_batches where id=any(p_batches) and operation_id is distinct from p_operation) then return;end if;
 if exists(select 1 from public.sms_batches where id=any(p_batches) and approved) or exists(select 1 from public.sms_jobs where batch_id=any(p_batches) and state<>'draft') then raise exception 'not_draft';end if;
 if (select count(distinct coalesce(event_id::text,'')) from public.sms_batches where id=any(p_batches))<>1 or (select count(*) from public.sms_jobs where batch_id=any(p_batches)) not between 1 and 50 then raise exception 'invalid_scope';end if;
 update public.sms_batches set operation_id=p_operation where id=any(p_batches);
end $$;
revoke all on function sms_private.register_send_operation(uuid,uuid[]) from public,anon;
grant execute on function sms_private.register_send_operation(uuid,uuid[]) to authenticated;
create function public.register_sms_send_operation(p_operation uuid,p_batches uuid[]) returns void
language sql security invoker set search_path='' as $$select sms_private.register_send_operation(p_operation,p_batches)$$;
revoke all on function public.register_sms_send_operation(uuid,uuid[]) from public,anon;
grant execute on function public.register_sms_send_operation(uuid,uuid[]) to authenticated;
create view public.sms_operation_list with(security_invoker=true) as
with source as (
 select coalesce(b.operation_id,j.batch_id,j.id) operation_id,j.id,j.event_id,j.created_at,j.state,j.applicant_name,j.recipient,
 coalesce(t.title,case j.kind when 'notification' then '신청 접수 알림' when 'test' then '연결 테스트' else '직접 작성' end) title,
 case when t.category='receipt' or j.kind='notification' then 'receipt'
 when t.title ~* '환불|refund' then 'refund'
 when t.category='payment' or t.title ~* '입금|payment.*(received|confirmed|request)' then 'payment'
 when t.category='confirmation' or t.title ~* '합격|선발|대기|accepted|declined|waitlist|final.*confirm' then 'selection'
 when t.category='reminder' or t.title ~* '이벤트|행사.*안내|리마인드|event.*(notice|detail)|reminder' then 'event' else 'direct' end purpose,
 (select min(h.happened_at) from public.sms_job_history h where h.job_id=j.id and h.state in ('accepted','delivered')) sent_at
 from public.sms_jobs j left join public.sms_batches b on b.id=j.batch_id left join public.event_sms_templates t on t.id=j.template_id
)
select operation_id,min(created_at) created_at,min(sent_at) sent_at,coalesce(min(sent_at),min(created_at)) sort_at,
 min(event_id::text)::uuid event_id,string_agg(distinct title,' · ') title,array_agg(distinct purpose) purposes,
 string_agg(coalesce(applicant_name,'')||' '||coalesce(recipient,''),' ') search_text,
 count(*)::int total,count(*) filter(where state in ('accepted','delivered'))::int completed,
 count(*) filter(where state='delivered')::int delivered,count(*) filter(where state='failed')::int failed,
 count(*) filter(where state in ('draft','queued','dispatching','unknown','accepted'))::int waiting,
 count(*) filter(where state='cancelled')::int cancelled,
 bool_or(state not in ('draft','cancelled')) has_activity
from source group by operation_id;
revoke all on public.sms_operation_list from public,anon;
grant select on public.sms_operation_list to authenticated;
commit;
