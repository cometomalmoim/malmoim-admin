begin;
do $$declare v_admin uuid;begin select user_id into v_admin from public.admin_users limit 1;perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);end $$;
set local role authenticated;
do $$declare v record;n integer;c integer;a integer;u integer;begin
 for v in select * from public.event_session_overview where event_slug='event-ade6a5a7-83c2-477b-94f0-a22444a785c3'loop
  select count(*)into n from public.event_application_admin_list where event_id=v.event_id and not is_archived;
  select count(*)into c from public.event_application_admin_list b join public.event_participation t on t.source=b.source and t.application_id=b.id where b.event_id=v.event_id and not b.is_archived and t.confirmation='confirmed';
  select count(*)into a from public.event_session_attendance m join public.event_application_admin_list b on b.source=m.source and b.id=m.application_id where m.session_id=v.id and not b.is_archived and m.attendance='attended';
  select count(*)into u from public.event_application_admin_list b join public.event_participation t on t.source=b.source and t.application_id=b.id left join public.event_session_attendance m on m.source=b.source and m.application_id=b.id and m.session_id=v.id where b.event_id=v.event_id and not b.is_archived and t.confirmation='confirmed' and coalesce(m.attendance,'unrecorded')='unrecorded';
  if n<>v.application_count or c<>v.confirmed_count or a<>v.attended_count or u<>v.unrecorded_count then raise exception 'session overview aggregate mismatch';end if;
 end loop;
 if not exists(select 1 from public.event_session_overview where event_slug='event-ade6a5a7-83c2-477b-94f0-a22444a785c3')then raise exception 'synthetic session required';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$begin if exists(select 1 from public.event_session_overview)then raise exception 'nonadmin aggregate exposure';end if;end $$;
reset role;
do $$begin if has_table_privilege('anon','public.event_session_overview','SELECT')then raise exception 'anonymous grant';end if;end $$;
rollback;
select 'PASS: active applicant totals, confirmed/attended/unrecorded counts, nonadmin and anonymous denial; rolled back' as verification;
