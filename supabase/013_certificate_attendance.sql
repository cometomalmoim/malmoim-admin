-- Apply only to an explicitly approved target after 011 and 012.
-- Certificate-only hardening. Existing attendance functions and storage are unchanged.
begin;
create or replace function public.record_certificate_batch(p_template uuid,p_rows jsonb,p_previous uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare r jsonb; a record; e record; old public.certificate_issues; seen text[]:=array[]::text[]; k text; locked_event uuid; t public.event_participation;
begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'forbidden'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 100 then raise exception 'invalid_batch'; end if;
 if not exists(select 1 from public.certificate_templates where id=p_template) then raise exception 'missing_template'; end if;
 if p_previous is not null then
  select * into old from public.certificate_issues where id=p_previous;
  if not found or old.template_id<>p_template or jsonb_array_length(p_rows)<>1 then raise exception 'invalid_reissue'; end if;
 end if;
 -- Lock all events first, in UUID order. Existing attendance/link/admin writers
 -- take the event FOR UPDATE before participation rows; never reverse that order.
 -- This also serializes multi-event batches consistently.
 for locked_event in select distinct (value->>'event_id')::uuid from jsonb_array_elements(p_rows) order by 1 loop
  perform 1 from public.recruitment_events where id=locked_event for share;
 end loop;
 for r in select value from jsonb_array_elements(p_rows)
          order by (value->>'event_id')::uuid, value->>'source', (value->>'application_id')::uuid loop
  k:=(r->>'event_id')||':'||(r->>'source')||':'||(r->>'application_id');
  if k is null or k=any(seen) then raise exception 'duplicate'; end if; seen:=array_append(seen,k);
  -- Recheck under locks in the recording transaction, after PDF generation.
  select * into e from public.recruitment_events where id=(r->>'event_id')::uuid;
  if not found or e.is_test then raise exception 'invalid_event'; end if;
  select * into t from public.event_participation
   where event_id=e.id and source=r->>'source' and application_id=(r->>'application_id')::uuid for share;
  if not found or t.attendance is distinct from 'attended' then raise exception 'attendance_required'; end if;
  if p_previous is not null then
   if (r->>'event_id')::uuid<>old.event_id or r->>'source'<>old.source or (r->>'application_id')::uuid<>old.application_id or r->>'name'<>old.name then raise exception 'changed_snapshot'; end if;
   insert into public.certificate_issues(template_id,event_id,source,application_id,name,event_title,previous_issue_id)
   values(old.template_id,old.event_id,old.source,old.application_id,old.name,old.event_title,old.id);
  else
   select * into e from public.recruitment_events where id=(r->>'event_id')::uuid for share;
   if not found or e.is_test then raise exception 'invalid_event'; end if;
   select name into a from public.event_application_list where event_id=e.id and source=r->>'source' and id=(r->>'application_id')::uuid;
   if not found or a.name is distinct from r->>'name' then raise exception 'changed_applicant'; end if;
   insert into public.certificate_issues(template_id,event_id,source,application_id,name,event_title)
   values(p_template,e.id,r->>'source',(r->>'application_id')::uuid,a.name,e.title);
  end if;
 end loop;
end $$;
revoke all on function public.record_certificate_batch(uuid,jsonb,uuid) from public,anon;
grant execute on function public.record_certificate_batch(uuid,jsonb,uuid) to authenticated;
commit;
