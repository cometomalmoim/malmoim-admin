begin;
create view public.event_session_overview with(security_invoker=true)as
 select s.id,s.session_date,s.title,s.event_id,e.slug as event_slug,e.title as event_title,e.is_test,
 count(a.id)as application_count,
 count(a.id)filter(where t.confirmation='confirmed')as confirmed_count,
 count(a.id)filter(where m.attendance='attended')as attended_count,
 count(a.id)filter(where m.attendance='absent')as absent_count,
 count(a.id)filter(where m.attendance='no_show')as no_show_count,
 count(a.id)filter(where t.confirmation='confirmed'and coalesce(m.attendance,'unrecorded')='unrecorded')as unrecorded_count,
 count(a.id)filter(where t.person_id is null)as unlinked_count
 from public.event_sessions s join public.recruitment_events e on e.id=s.event_id
 left join public.event_application_admin_list a on a.event_id=s.event_id and not a.is_archived
 left join public.event_participation t on t.event_id=s.event_id and t.source=a.source and t.application_id=a.id
 left join public.event_session_attendance m on m.session_id=s.id and m.source=a.source and m.application_id=a.id
 group by s.id,e.id;
revoke all on public.event_session_overview from public,anon;grant select on public.event_session_overview to authenticated;
commit;
