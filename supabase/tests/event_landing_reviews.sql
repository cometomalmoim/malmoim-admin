-- Synthetic rows exist only in this transaction; none are publicly committed.
begin;
select set_config('request.jwt.claim.sub',(select user_id::text from public.admin_users limit 1),true);
set local role authenticated;
do $$ declare event uuid; id uuid='33333333-3333-4333-8333-333333333333'; data jsonb; begin
 select e.id into event from public.recruitment_events e where e.slug='season9';
 if public.save_event_review(event,id,0,'[가상] 비공개 검증','ko','[가상] 후기 원문','비공개 메모',1,false,false)<>'saved' then raise exception 'draft'; end if;
 if exists(select 1 from jsonb_array_elements(public.public_event_reviews('season9')) r where r->>'id'=id::text) then raise exception 'draft leaked'; end if;
 if public.save_event_review(event,id,0,'가상','ko','가상','',1,true,false)<>'invalid' then raise exception 'consent'; end if;
 if public.save_event_review(event,id,0,'가상','ko','가상','비공개 메모',1,true,true)<>'saved' then raise exception 'publish'; end if;
 select r into data from jsonb_array_elements(public.public_event_reviews('season9')) r where r->>'id'=id::text;
 if data is null or data ? 'source_note' or data ? 'updated_by' then raise exception 'public projection'; end if;
 if public.save_event_review(event,id,0,'가상','ko','덮어쓰기','',1,true,true)<>'stale' then raise exception 'revision'; end if;
 if public.save_event_review(event,id,1,'가상','en','Synthetic text','',1,false,true)<>'saved' then raise exception 'unpublish'; end if;
 if exists(select 1 from jsonb_array_elements(public.public_event_reviews('season9')) r where r->>'id'=id::text) then raise exception 'hidden leaked'; end if;
 begin update public.event_landing_reviews set body='bad' where event_id=event;raise exception 'direct update allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$ begin
 perform public.public_event_reviews('season9');
 begin perform 1 from public.event_landing_reviews;raise exception 'anon table allowed';exception when insufficient_privilege then null;end;
 begin perform public.save_event_review(gen_random_uuid(),gen_random_uuid(),0,'가상','ko','가상','',0,false,false);raise exception 'anon save allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.event_landing_reviews) then raise exception 'nonadmin list allowed';end if;
 if public.save_event_review(gen_random_uuid(),gen_random_uuid(),0,'가상','ko','가상','',0,false,false)<>'forbidden' then raise exception 'nonadmin save';end if;
end $$;
reset role;
rollback;
select 'review role/publication/revision checks passed; all synthetic writes rolled back' as result;
