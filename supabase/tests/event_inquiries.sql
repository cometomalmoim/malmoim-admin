-- Run after 039. Fake inquiries only; all writes roll back. No SMS functions.
begin;
create temp table inquiry_test_context(event_slug text,admin_id uuid);
insert into inquiry_test_context select e.slug,a.user_id from public.recruitment_events e cross join public.admin_users a where e.slug='season9' and not e.is_archived and not e.is_test limit 1;
do $$ begin if not exists(select 1 from inquiry_test_context) then raise exception 'Test prerequisites missing'; end if; end $$;
-- Public submission and lookup, idempotency, no broad reads.
set local role anon;
do $$ begin
 if public.submit_event_inquiry('season9',repeat('1',64),'[가상] SQL 문의 검증','[가상] 문의 검증','[가상] 문의 내용','ko',true)<>'saved' then raise exception 'submit'; end if;
 if public.submit_event_inquiry('season9',repeat('1',64),'[가상] SQL 문의 검증','[가상] 문의 검증','[가상] 문의 내용','ko',true)<>'saved' then raise exception 'retry'; end if;
 if public.submit_event_inquiry('season9',repeat('1',64),'[가상] SQL 문의 검증','다른 내용','[가상] 문의 내용','ko',true)<>'invalid' then raise exception 'token reuse'; end if;
 if public.submit_event_inquiry('season9',repeat('2',64),'가상','제목','내용','ko',false)<>'invalid' then raise exception 'consent'; end if;
 if public.read_event_inquiry(repeat('1',64))->>'subject'<>'[가상] 문의 검증' then raise exception 'lookup'; end if;
 if public.read_event_inquiry(repeat('f',64)) is not null then raise exception 'isolation'; end if;
 begin perform 1 from public.event_inquiries; raise exception 'anon select should fail'; exception when insufficient_privilege then null; end;
 begin perform public.reply_event_inquiry(gen_random_uuid(),0,'bad'); raise exception 'anon reply should fail'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.event_inquiries) then raise exception 'nonadmin reads'; end if;
 if public.reply_event_inquiry(gen_random_uuid(),0,'bad')<>'forbidden' then raise exception 'nonadmin reply'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select admin_id::text from inquiry_test_context),true);
set local role authenticated;
do $$ declare target uuid; begin
 select id into target from public.event_inquiries where receipt_token=repeat('1',64);
 if target is null then raise exception 'admin read'; end if;
 if public.reply_event_inquiry(target,0,'[가상] 답변 1')<>'saved' then raise exception 'admin reply'; end if;
 if public.reply_event_inquiry(target,0,'[가상] 중복')<>'stale' then raise exception 'revision'; end if;
 if public.reply_event_inquiry(target,1,'[가상] 답변 2')<>'saved' then raise exception 'additional reply'; end if;
 if (select count(*) from public.event_inquiry_replies where inquiry_id=target)<>2 then raise exception 'reply history'; end if;
 if public.read_event_inquiry(repeat('1',64))->>'status'<>'answered' then raise exception 'status'; end if;
 begin update public.event_inquiries set status='received' where id=target; raise exception 'direct write should fail'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'inquiry SQL checks passed; all fake writes rolled back' as result;
