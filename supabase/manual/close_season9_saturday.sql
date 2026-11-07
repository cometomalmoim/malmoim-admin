do $migration$
declare fn record; definition text; patched text; n integer:=0;
begin
 for fn in select oid from pg_proc where pronamespace='public'::regnamespace and proname in ('submit_season9_application','submit_season9_before_required_fields','submit_season9_compact_application','submit_season9_compact_application_v2') and pg_get_function_identity_arguments(oid)='payload jsonb'
 loop
  definition:=replace(pg_get_functiondef(fn.oid),chr(13),'');
  if position('saturday_registration_closed' in definition)>0 then continue;end if;
  patched:=regexp_replace(definition,E'\nbegin\n',E'\nbegin\n if payload->>''preferred_class''=''saturday'' then raise exception ''saturday_registration_closed''; end if;\n','i');
  if patched=definition then raise exception 'Could not locate function body';end if;
  execute patched;n:=n+1;
 end loop;
 if n<>4 then raise exception 'Expected four Season 9 submission functions, patched %',n;end if;
end $migration$;
