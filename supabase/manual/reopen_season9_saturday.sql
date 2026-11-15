-- Reverse only the Saturday guard installed by close_season9_saturday.sql.
-- Preserve existing validation, permissions, duplicate handling and notifications.
do $migration$
declare fn record; definition text; patched text; n integer:=0;
begin
 for fn in select oid from pg_proc where pronamespace='public'::regnamespace and proname in ('submit_season9_application','submit_season9_before_required_fields','submit_season9_compact_application','submit_season9_compact_application_v2') and pg_get_function_identity_arguments(oid)='payload jsonb'
 loop
  definition:=replace(pg_get_functiondef(fn.oid),chr(13),'');
  patched:=replace(definition,E' if payload->>''preferred_class''=''saturday'' then raise exception ''saturday_registration_closed''; end if;\n','');
  if position('saturday_registration_closed' in patched)>0 then raise exception 'Unexpected Saturday guard; review function %',fn.oid::regprocedure;end if;
  if patched<>definition then execute patched;end if;
  n:=n+1;
 end loop;
 if n<>4 then raise exception 'Expected four Season 9 submission functions, found %',n;end if;
 if not coalesce((public.season9_registration_info()->>'open')::boolean,false) then raise exception 'Season 9 general registration is not open';end if;
end $migration$;
