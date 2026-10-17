-- Guard open attendance screens against concurrent schedule edits.
begin;
create function public.record_session_attendance(p_slug text,p_session uuid,p_source text,p_application uuid,p_revision integer,p_participation_revision integer,p_attendance text,p_session_revision integer)returns text
language plpgsql security definer set search_path='' as $$
declare e public.recruitment_events;s public.event_sessions;begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid())then return 'forbidden';end if;
 select * into e from public.recruitment_events where slug=p_slug for update;if not found then return 'missing';end if;
 select * into s from public.event_sessions where id=p_session and event_id=e.id;if not found then return 'missing';end if;
 if p_session_revision is distinct from s.revision then return 'conflict';end if;
 return public.record_session_attendance(p_slug,p_session,p_source,p_application,p_revision,p_participation_revision,p_attendance);
end $$;
revoke all on function public.record_session_attendance(text,uuid,text,uuid,integer,integer,text)from public,anon,authenticated;
revoke all on function public.record_session_attendance(text,uuid,text,uuid,integer,integer,text,integer)from public,anon,authenticated;
grant execute on function public.record_session_attendance(text,uuid,text,uuid,integer,integer,text,integer)to authenticated;
commit;
