-- Apply only AFTER the app uses submit_event_registration_with_profile.
-- Close direct legacy intake calls that omit nationality/gender; no RLS changes.
begin;
revoke execute on function public.submit_event_registration(text,uuid,text,text,text,text,boolean,text,boolean,boolean) from anon,authenticated;
revoke execute on function public.submit_event_registration_attributed(text,uuid,text,text,text,text,boolean,text,boolean,boolean,text,text,text) from anon,authenticated;
revoke execute on function public.submit_event_registration_with_birth_year(text,uuid,text,text,text,text,boolean,text,boolean,boolean,text,text,text,integer) from anon,authenticated;
revoke execute on function public.submit_event_registration_with_nationality(text,uuid,text,text,text,text,boolean,text,boolean,boolean,text,text,text,integer,text) from anon,authenticated;
commit;
