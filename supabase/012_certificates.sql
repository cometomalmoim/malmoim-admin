-- REVIEW ONLY. Do not execute against production as part of development.
-- Independent module: no existing applicant/payment/attendance/resource objects modified.
begin;
create table public.certificate_templates (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 150),
 path text not null, mime text not null check(mime in ('application/pdf','image/png','image/jpeg')),
 placement jsonb not null check(
 jsonb_typeof(placement)='object' and placement ?& array['x','y','size','align']
 and (placement->>'x')::numeric between 0 and 100 and (placement->>'y')::numeric between 0 and 100
 and (placement->>'size')::numeric between 8 and 96 and placement->>'align' in ('left','center','right')),
 created_at timestamptz not null default now(), created_by uuid not null default auth.uid() references auth.users(id)
);
-- Templates are immutable versions; editing settings inserts a new row.
create table public.certificate_issues (
 id uuid primary key default gen_random_uuid(), template_id uuid not null references public.certificate_templates(id),
 event_id uuid not null references public.recruitment_events(id), source text not null check(source in ('season9','registration','manual')),
 application_id uuid not null, name text not null check(length(name) between 1 and 100), event_title text not null,
 previous_issue_id uuid references public.certificate_issues(id),
 created_at timestamptz not null default now(), created_by uuid not null default auth.uid() references auth.users(id)
);
create index certificate_issues_event on public.certificate_issues(event_id,created_at desc,id);
create index certificate_issues_identity on public.certificate_issues(event_id,source,application_id);
alter table public.certificate_templates enable row level security;
alter table public.certificate_templates force row level security;
alter table public.certificate_issues enable row level security;
alter table public.certificate_issues force row level security;
revoke all on public.certificate_templates,public.certificate_issues from public,anon,authenticated;
grant select,insert on public.certificate_templates to authenticated;
grant select on public.certificate_issues to authenticated;
create policy certificate_templates_read on public.certificate_templates for select to authenticated using(exists(select 1 from public.admin_users where user_id=auth.uid()));
create policy certificate_templates_insert on public.certificate_templates for insert to authenticated with check(created_by=auth.uid() and exists(select 1 from public.admin_users where user_id=auth.uid()));
create policy certificate_issues_read on public.certificate_issues for select to authenticated using(exists(select 1 from public.admin_users where user_id=auth.uid()));
create function public.record_certificate_batch(p_template uuid,p_rows jsonb,p_previous uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare r jsonb; a record; e record; old public.certificate_issues; seen text[]:=array[]::text[]; k text;
begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'forbidden'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 100 then raise exception 'invalid_batch'; end if;
 if not exists(select 1 from public.certificate_templates where id=p_template) then raise exception 'missing_template'; end if;
 if p_previous is not null then
  select * into old from public.certificate_issues where id=p_previous;
  if not found or old.template_id<>p_template or jsonb_array_length(p_rows)<>1 then raise exception 'invalid_reissue'; end if;
 end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  k:=(r->>'event_id')||':'||(r->>'source')||':'||(r->>'application_id');
  if k is null or k=any(seen) then raise exception 'duplicate'; end if; seen:=array_append(seen,k);
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
-- Dedicated private bucket; never change admin-resources.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('certificate-templates','certificate-templates',false,5242880,array['application/pdf','image/png','image/jpeg']);
create policy certificate_storage_read on storage.objects for select to authenticated using(bucket_id='certificate-templates' and exists(select 1 from public.admin_users where user_id=auth.uid()));
create policy certificate_storage_insert on storage.objects for insert to authenticated with check(bucket_id='certificate-templates' and exists(select 1 from public.admin_users where user_id=auth.uid()));
-- Only orphan uploads may be cleaned up. Referenced originals remain immutable for reissue.
create policy certificate_storage_delete on storage.objects for delete to authenticated using(bucket_id='certificate-templates' and exists(select 1 from public.admin_users where user_id=auth.uid()) and not exists(select 1 from public.certificate_templates where path=name));
commit;
