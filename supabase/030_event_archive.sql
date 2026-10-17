-- Reversible event deletion; related applications, attendance and certificates remain.
begin;
alter table public.recruitment_events add column is_archived boolean not null default false,add column archive_revision integer not null default 0;
create table public.event_archive_audit(id uuid primary key default gen_random_uuid(),event_id uuid not null references public.recruitment_events(id),archived boolean not null,actor uuid not null,previous jsonb not null,current_value jsonb not null,created_at timestamptz not null default now());
alter table public.event_archive_audit enable row level security;alter table public.event_archive_audit force row level security;
revoke all on public.event_archive_audit from public,anon,authenticated;grant select on public.event_archive_audit to authenticated;
create policy "Admins read event archive audit"on public.event_archive_audit for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create function public.guard_archived_event() returns trigger language plpgsql set search_path='' as $$begin if new.is_archived and new.applications_open then raise exception 'Archived events cannot open intake';end if;return new;end $$;
create trigger event_archive_intake_guard before insert or update on public.recruitment_events for each row execute function public.guard_archived_event();
create function public.archive_recruitment_event(p_slug text,p_revision integer,p_archived boolean)returns text language plpgsql security definer set search_path='' as $$
declare e public.recruitment_events;begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid())then return 'forbidden';end if;
 if p_archived is null or p_revision is null or p_revision<0 then return 'invalid';end if;
 select * into e from public.recruitment_events where slug=p_slug for update;if not found then return 'missing';end if;
 if p_revision is distinct from e.archive_revision then return 'conflict';end if;
 if e.is_archived=p_archived then return 'unchanged';end if;
 update public.recruitment_events set is_archived=p_archived,archive_revision=archive_revision+1,applications_open=false where id=e.id;
 insert into public.event_archive_audit(event_id,archived,actor,previous,current_value)values(e.id,p_archived,auth.uid(),jsonb_build_object('archived',e.is_archived,'applications_open',e.applications_open),jsonb_build_object('archived',p_archived,'applications_open',false));
 return 'saved';end $$;
-- Existing public intake signatures remain; archived test events must also be closed.
alter function public.event_registration_info(text,boolean) rename to event_registration_info_before_archive;
create function public.event_registration_info(p_slug text,p_test boolean default false)returns jsonb language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from public.recruitment_events where slug=p_slug and is_archived)then return jsonb_build_object('open',false);end if;
 return public.event_registration_info_before_archive(p_slug,p_test);
end $$;
revoke all on function public.event_registration_info_before_archive(text,boolean)from public,anon,authenticated;
revoke all on function public.event_registration_info(text,boolean)from public,anon,authenticated;
grant execute on function public.event_registration_info(text,boolean)to anon,authenticated;
create function public.guard_archived_application()returns trigger language plpgsql security definer set search_path='' as $$declare archived boolean;begin
 select is_archived into archived from public.recruitment_events where id=new.event_id for update;
 if archived then raise exception 'Archived event cannot receive new applications';end if;return new;
end $$;
create trigger registration_event_archive_guard before insert on public.event_registration_responses for each row execute function public.guard_archived_application();
create trigger season9_event_archive_guard before insert on public.event_applications for each row execute function public.guard_archived_application();
create trigger manual_event_archive_guard before insert on public.event_manual_applications for each row execute function public.guard_archived_application();
revoke all on function public.guard_archived_event(),public.guard_archived_application(),public.archive_recruitment_event(text,integer,boolean)from public,anon,authenticated;
grant execute on function public.archive_recruitment_event(text,integer,boolean)to authenticated;
commit;
