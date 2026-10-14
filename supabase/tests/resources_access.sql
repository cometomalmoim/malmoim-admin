-- SQL005 적용된 테스트 환경 전용. 실제 파일 업로드는 별도 API 통합 테스트 필요.
-- 가상 자료는 transaction 마지막 rollback으로 제거됩니다. 운영에서는 실행하지 마세요.
begin;
select set_config('request.jwt.claims',json_build_object('sub',(select user_id from public.admin_users limit 1),'email','test-only@example.invalid','role','authenticated')::text,true);
set local role authenticated;
do $$
declare rid uuid; i integer;
begin
 if auth.uid() is null then raise exception '테스트용 관리자 등록 필요'; end if;
 insert into public.resources(title,kind,season,session_number,cumulative_week) values('검증 전용','english',2,1,7) returning id into rid;
 if not exists(select 1 from public.resources where id=rid and author_id=auth.uid() and cumulative_week=7 and session_number=1) then raise exception '작성자/회차 검사 실패'; end if;
 for i in 1..5 loop
  insert into public.resource_files(resource_id,original_name,size_bytes) values(rid,'test-only.pdf',100);
 end loop;
 begin
  insert into public.resource_files(resource_id,original_name,size_bytes) values(rid,'sixth.pdf',100);
  raise exception '파일 한도 검사 실패';
 exception when raise_exception then
  if SQLERRM <> 'resource_file_limit' then raise; end if;
 end;
end $$;
reset role;
-- 실제 사용자가 없는 임의 UUID의 authenticated claim. 관리자 목록 포함 여부 사전 확인.
select set_config('request.jwt.claims',json_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
set local role authenticated;
do $$
begin
 if exists(select 1 from public.resources) or exists(select 1 from public.resource_files) then raise exception '일반 사용자 조회 차단 실패'; end if;
 if exists(select 1 from storage.objects where bucket_id='admin-resources') then raise exception '일반 사용자 Storage 조회 차단 실패'; end if;
 begin
  insert into public.resources(title,kind)values('거부되어야 함','common');
  raise exception '일반 사용자 쓰기 차단 실패';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
set local role anon;
do $$
begin
 begin
  perform 1 from public.resources;
  raise exception '비회원 조회 차단 실패';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
rollback;
