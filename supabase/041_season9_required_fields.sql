-- New submissions only. Preserve existing rows, intake checks and notification triggers.
begin;
alter function public.submit_season9_application(jsonb) rename to submit_season9_before_required_fields;
revoke all on function public.submit_season9_before_required_fields(jsonb) from public,anon,authenticated;
create function public.submit_season9_application(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if payload is null or jsonb_typeof(payload)<>'object'
 or coalesce(payload->>'gender','') not in ('남성 / Male','여성 / Female','답변하지 않음 / Prefer not to say')
 or coalesce(char_length(btrim(payload->>'occupation')),0) not between 1 and 200
 or coalesce(payload->>'occupation','') !~ '[^[:space:]]'
 or coalesce(char_length(btrim(payload->>'motivation')),0) not between 1 and 2000
 or coalesce(payload->>'motivation','') !~ '[^[:space:]]'
 then raise exception 'required_profile_fields'; end if;
 return public.submit_season9_before_required_fields(payload);
end $$;
revoke all on function public.submit_season9_application(jsonb) from public,anon,authenticated;
grant execute on function public.submit_season9_application(jsonb) to anon,authenticated;
commit;
