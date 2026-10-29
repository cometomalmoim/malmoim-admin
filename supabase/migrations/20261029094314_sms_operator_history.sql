begin;
create or replace view public.sms_operation_list with(security_invoker=true) as
with source as (
 select coalesce(b.operation_id,j.batch_id,j.id) operation_id,j.id,j.event_id,j.created_at,j.state,j.applicant_name,j.recipient,(j.kind='notification') operator_notification,
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
 bool_or(state not in ('draft','cancelled')) has_activity,bool_and(operator_notification) operator_notification
from source group by operation_id;
commit;
