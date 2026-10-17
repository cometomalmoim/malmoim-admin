begin;
create table public.event_application_archives(
 event_id uuid not null references public.recruitment_events(id),source text not null check(source in ('manual','registration','season9')),
 application_id uuid not null,archived boolean not null,revision integer not null default 1,updated_by uuid not null,updated_at timestamptz not null default now(),
 primary key(source,application_id)
);
create table public.event_application_archive_audit(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.recruitment_events(id),source text not null,application_id uuid not null,
 archived boolean not null,actor uuid not null,created_at timestamptz not null default now()
);
alter table public.event_application_archives enable row level security;
alter table public.event_application_archives force row level security;
alter table public.event_application_archive_audit enable row level security;
alter table public.event_application_archive_audit force row level security;
revoke all on public.event_application_archives,public.event_application_archive_audit from public,anon,authenticated;
grant select on public.event_application_archives,public.event_application_archive_audit to authenticated;
create policy application_archives_admin_read on public.event_application_archives for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy application_archive_audit_admin_read on public.event_application_archive_audit for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create view public.event_application_admin_list with(security_invoker=true) as
 select b.*,coalesce(a.archived,false) is_archived,coalesce(a.revision,0) archive_revision
 from public.event_application_traffic_list b left join public.event_application_archives a on a.event_id=b.event_id and a.source=b.source and a.application_id=b.id;
revoke all on public.event_application_admin_list from public,anon;
grant select on public.event_application_admin_list to authenticated;
create function public.archive_event_applications(p_items jsonb,p_archived boolean) returns text
language plpgsql security definer set search_path='' as $$
declare item jsonb; a public.event_application_admin_list;
begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid()) then return 'forbidden';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or p_archived is null then return 'invalid';end if;
 if jsonb_array_length(p_items) not between 1 and 25 then return 'invalid';end if;
 if (select count(*) from (select distinct x->>'source',x->>'id' from jsonb_array_elements(p_items) x) s)<>jsonb_array_length(p_items) then return 'invalid';end if;
 -- Same event lock order as application management; validate all before any writes.
 perform id from public.recruitment_events where id in(select (x->>'event_id')::uuid from jsonb_array_elements(p_items) x) order by id for update;
 for item in select value from jsonb_array_elements(p_items) loop
  select * into a from public.event_application_admin_list where event_id=(item->>'event_id')::uuid and source=item->>'source' and id=(item->>'id')::uuid;
  if not found then return 'missing';end if;
  if a.revision is distinct from (item->>'revision')::integer or a.archive_revision is distinct from (item->>'archive_revision')::integer or a.is_archived=p_archived then return 'conflict';end if;
 end loop;
 for item in select value from jsonb_array_elements(p_items) loop
  insert into public.event_application_archives(event_id,source,application_id,archived,updated_by)
  values((item->>'event_id')::uuid,item->>'source',(item->>'id')::uuid,p_archived,auth.uid())
  on conflict(source,application_id) do update set archived=excluded.archived,revision=public.event_application_archives.revision+1,updated_by=excluded.updated_by,updated_at=clock_timestamp();
  insert into public.event_application_archive_audit(event_id,source,application_id,archived,actor)
  values((item->>'event_id')::uuid,item->>'source',(item->>'id')::uuid,p_archived,auth.uid());
 end loop;
 return 'saved';
exception when invalid_text_representation or numeric_value_out_of_range then return 'invalid';
end $$;
revoke all on function public.archive_event_applications(jsonb,boolean) from public,anon;
grant execute on function public.archive_event_applications(jsonb,boolean) to authenticated;
commit;
