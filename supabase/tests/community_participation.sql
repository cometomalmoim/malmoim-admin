begin;
do $$ declare s uuid;begin
 insert into public.community_daily_sessions(title,starts_at,ends_at,closes_at,location,fee,is_open) values('[가상 테스트] 일일참여',now()+interval '10 days',now()+interval '10 days 150 minutes',now()+interval '9 days','[가상] 장소',12000,true) returning id into s;
 perform set_config('test.community_session',s::text,true);
 perform set_config('test.daily_token',encode(extensions.gen_random_bytes(32),'hex'),true);
 perform set_config('test.exchange_token',encode(extensions.gen_random_bytes(32),'hex'),true);
 if has_table_privilege('anon','public.community_participation_requests','select') then raise exception 'Anon has request-table access';end if;
end $$;
set local role anon;
do $$ declare s uuid:=current_setting('test.community_session')::uuid; t text:=current_setting('test.daily_token');x text; j jsonb;begin
 begin perform 1 from public.community_participation_requests;raise exception 'Anonymous table access succeeded';exception when insufficient_privilege then null;end;
 x:=public.submit_community_request('daily',t,'[가상] 신청자','email','SYNTHETIC@example.invalid','ko',s,'{"notes":"test"}',false);if x<>'invalid' then raise exception 'Consent bypass: %',x;end if;
 x:=public.submit_community_request('daily',t,'[가상] 신청자','email','SYNTHETIC@example.invalid','ko',s,'{"notes":"test"}',true);if x<>'saved' then raise exception 'Daily submit: %',x;end if;
 x:=public.submit_community_request('daily',t,'[가상] 신청자','email','synthetic@example.invalid','ko',s,'{"notes":"test"}',true);if x<>'saved' then raise exception 'Idempotency: %',x;end if;
 x:=public.submit_community_request('daily',repeat('e',64),'[가상] 신청자','email','synthetic@example.invalid','ko',s,'{"notes":"test"}',true);if x<>'duplicate' then raise exception 'Duplicate bypass: %',x;end if;
 j:=public.read_community_request(t);if j->>'status'<>'received' or j ? 'contact' or j ? 'token_hash' then raise exception 'Receipt mismatch or overdisclosure';end if;
 if public.read_community_request(repeat('0',64)) is not null then raise exception 'Wrong token disclosed record';end if;
 x:=public.cancel_community_request(t);if x<>'saved' or public.read_community_request(t)->>'status'<>'cancelled' then raise exception 'Cancellation failed';end if;
 x:=public.submit_community_request('exchange',current_setting('test.exchange_token'),'[가상] 매칭','instagram','@synthetic_test','en',null,'{"offered_language":"en","learning_language":"ko","offered_level":"native","learning_level":"beginner","meeting_mode":"online","availability":"Tue 7pm KST","area":"","other_languages":"","notes":""}',true);if x<>'saved' then raise exception 'Exchange submit failed: %',x;end if;
 x:=public.submit_community_request('exchange',repeat('f',64),'test','email','test@example.invalid','en',null,'{"offered_language":"en","learning_language":"en"}',true);if x<>'invalid' then raise exception 'Language validation failed';end if;
end $$;
reset role;
do $$ declare r public.community_participation_requests;x text;begin
 select * into r from public.community_participation_requests where token_hash=encode(extensions.digest(current_setting('test.exchange_token'),'sha256'),'hex');
 x:=public.manage_community_request(r.id,0,'confirmed','test');if x<>'forbidden' then raise exception 'Non-admin manage bypass';end if;
 perform set_config('request.jwt.claim.sub',(select user_id::text from public.admin_users limit 1),true);
 x:=public.manage_community_request(r.id,0,'reviewing','[가상] 검토 중');if x<>'saved' then raise exception 'Admin update failed %',x;end if;
 x:=public.manage_community_request(r.id,0,'confirmed','stale');if x<>'stale' then raise exception 'Optimistic locking failed %',x;end if;
 if public.read_community_request(current_setting('test.exchange_token'))->>'message'<>'[가상] 검토 중' then raise exception 'Public status not updated';end if;
end $$;
rollback;
