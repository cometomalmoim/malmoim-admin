-- Requires 012 and 013. Review/apply only to an explicitly approved target.
begin;
create table public.certificate_jobs (
 id uuid primary key, created_by uuid not null default auth.uid() references auth.users(id),
 request jsonb not null, spec jsonb not null,
 status text not null default 'processing' check(status in ('processing','ready','failed','expired')),
 path text not null, mime text not null check(mime in ('application/pdf','application/zip')),
 size_bytes bigint, error_code text, cleaned_at timestamptz,
 created_at timestamptz not null default now(), expires_at timestamptz not null default (now()+interval '2 minutes'),
 check(jsonb_typeof(spec->'rows')='array' and jsonb_array_length(spec->'rows') between 1 and 20)
);
alter table public.certificate_issues add column download_job_id uuid references public.certificate_jobs(id)
 default nullif(current_setting('certificates.download_job',true),'')::uuid;
create index certificate_issues_job on public.certificate_issues(download_job_id);
create index certificate_jobs_expiry on public.certificate_jobs(expires_at);
alter table public.certificate_jobs enable row level security;
alter table public.certificate_jobs force row level security;
revoke all on public.certificate_jobs from public,anon,authenticated;
grant select on public.certificate_jobs to authenticated;
create policy certificate_jobs_read on public.certificate_jobs for select to authenticated
 using(created_by=auth.uid() and exists(select 1 from public.admin_users where user_id=auth.uid()));
create table public.certificate_uploads (
 id uuid primary key, created_by uuid not null default auth.uid() references auth.users(id),
 mime text not null check(mime in ('application/pdf','image/png','image/jpeg')), cleaned_at timestamptz,
 created_at timestamptz not null default now(), expires_at timestamptz not null default(now()+interval '2 hours')
);
alter table public.certificate_uploads enable row level security;
alter table public.certificate_uploads force row level security;
revoke all on public.certificate_uploads from public,anon,authenticated;
grant select,insert on public.certificate_uploads to authenticated;
create policy certificate_uploads_read on public.certificate_uploads for select to authenticated
 using(created_by=auth.uid() and exists(select 1 from public.admin_users where user_id=auth.uid()));
create policy certificate_uploads_insert on public.certificate_uploads for insert to authenticated
 with check(created_by=auth.uid() and exists(select 1 from public.admin_users where user_id=auth.uid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('certificate-downloads','certificate-downloads',false,67108864,array['application/pdf','application/zip']),
 ('certificate-staging','certificate-staging',false,5242880,array['application/pdf','image/png','image/jpeg']);
create policy certificate_downloads_read on storage.objects for select to authenticated using(
 bucket_id='certificate-downloads' and exists(select 1 from public.certificate_jobs j where j.path=name and j.status='ready' and j.expires_at>now()));
-- Storage DELETE needs SELECT visibility too. Permit only delete operations,
-- never object GET/sign/list, for expired/failed objects awaiting cleanup.
create policy certificate_downloads_cleanup_read on storage.objects for select to authenticated using(
 bucket_id='certificate-downloads' and storage.allow_any_operation(array['storage.object.delete','storage.object.delete_many'])
 and exists(select 1 from public.certificate_jobs j where j.path=name and (j.status in ('failed','expired') or j.expires_at<=now())));
create policy certificate_downloads_insert on storage.objects for insert to authenticated with check(
 bucket_id='certificate-downloads' and exists(select 1 from public.certificate_jobs j where j.path=name and j.status='processing' and j.expires_at>now()));
create policy certificate_downloads_delete on storage.objects for delete to authenticated using(
 bucket_id='certificate-downloads' and exists(select 1 from public.certificate_jobs j where j.path=name and (j.status in ('failed','expired') or j.expires_at<=now())));
create policy certificate_staging_read on storage.objects for select to authenticated using(
 bucket_id='certificate-staging' and exists(select 1 from public.certificate_uploads u where name=u.id::text||'/original'));
create policy certificate_staging_insert on storage.objects for insert to authenticated with check(
 bucket_id='certificate-staging' and exists(select 1 from public.certificate_uploads u where name=u.id::text||'/original' and u.expires_at>now()));
create policy certificate_staging_delete on storage.objects for delete to authenticated using(
 bucket_id='certificate-staging' and exists(select 1 from public.certificate_uploads u where name=u.id::text||'/original'));

create function public.begin_certificate_job(p_id uuid,p_request jsonb,p_spec jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare j public.certificate_jobs; v_mime text;begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid())then raise exception 'forbidden';end if;
 if p_id is null or p_request is null or p_spec is null or jsonb_typeof(p_spec->'rows') is distinct from 'array'
  or jsonb_array_length(p_spec->'rows') not between 1 and 20 then raise exception 'invalid_job';end if;
 v_mime:=case when (p_spec->>'zip')::boolean then 'application/zip' else 'application/pdf' end;
 insert into public.certificate_jobs(id,request,spec,path,mime) values(p_id,p_request,p_spec,p_id::text||'/result.'||case when v_mime='application/zip' then 'zip' else 'pdf' end,v_mime)
 on conflict(id)do nothing;
 if found then return 'claimed';end if;
 select * into j from public.certificate_jobs where id=p_id for update;
 if j.created_by<>auth.uid() or j.request is distinct from p_request then raise exception 'job_conflict';end if;
 return case when j.expires_at<=now() then 'expired' else j.status end;
end $$;
create function public.finish_certificate_job(p_id uuid,p_size bigint) returns void
language plpgsql security definer set search_path='' as $$
declare j public.certificate_jobs;begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid())then raise exception 'forbidden';end if;
 select * into j from public.certificate_jobs where id=p_id and created_by=auth.uid() for update;
 if not found then raise exception 'missing_job';end if;
 if j.status='ready' then return;end if;
 if j.status<>'processing' or j.expires_at<=clock_timestamp() or p_size not between 1 and 67108864 then raise exception 'invalid_job';end if;
 if not exists(select 1 from storage.objects where bucket_id='certificate-downloads' and name=j.path
  and (metadata->>'size')::bigint=p_size and metadata->>'mimetype'=j.mime) then raise exception 'missing_file';end if;
 -- Job -> sorted events -> participation, same ordering for every issuance.
 -- Existing attendance writers never acquire a certificate job lock.
 if not coalesce((j.spec->>'preview')::boolean,false)then
  perform set_config('certificates.download_job',j.id::text,true);
  perform public.record_certificate_batch((j.spec->>'template')::uuid,j.spec->'rows',nullif(j.spec->>'previous','')::uuid);
  perform set_config('certificates.download_job','',true);
 end if;
 -- A concurrent attendance writer may have held the event lock past the lease.
 if j.expires_at<=clock_timestamp() then raise exception 'job_expired';end if;
 update public.certificate_jobs set status='ready',size_bytes=p_size,expires_at=clock_timestamp()+interval '24 hours' where id=p_id;
end $$;
create function public.fail_certificate_job(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid())then raise exception 'forbidden';end if;
 update public.certificate_jobs set status='failed',error_code='generation_failed' where id=p_id and created_by=auth.uid() and status='processing';
end $$;
create function public.expire_certificate_jobs() returns void
language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid())then raise exception 'forbidden';end if;
 update public.certificate_jobs set status='expired' where created_by=auth.uid() and expires_at<=clock_timestamp() and status<>'expired';
end $$;
create function public.mark_certificate_cleaned(p_id uuid,p_upload boolean) returns void
language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid())then raise exception 'forbidden';end if;
 if p_upload then
  if exists(select 1 from storage.objects o where o.bucket_id='certificate-templates' and o.name=p_id::text||'/original'
   and not exists(select 1 from public.certificate_templates t where t.path=o.name))then raise exception 'file_not_removed';end if;
  if exists(select 1 from storage.objects where bucket_id='certificate-staging' and name=p_id::text||'/original')then raise exception 'file_not_removed';end if;
  update public.certificate_uploads set cleaned_at=clock_timestamp() where id=p_id and created_by=auth.uid() and expires_at<clock_timestamp()-interval '10 minutes';
 else
  if exists(select 1 from storage.objects where bucket_id='certificate-downloads' and name in(select path from public.certificate_jobs where id=p_id))then raise exception 'file_not_removed';end if;
  update public.certificate_jobs set cleaned_at=clock_timestamp() where id=p_id and created_by=auth.uid() and status in ('failed','expired');
 end if;
end $$;
revoke all on function public.mark_certificate_cleaned(uuid,boolean) from public,anon;
grant execute on function public.mark_certificate_cleaned(uuid,boolean) to authenticated;
-- Only the storage-aware finalizer may call the old recorder. Keep its exact
-- attendance/snapshot/locking implementation; direct clients cannot skip file persistence.
revoke execute on function public.record_certificate_batch(uuid,jsonb,uuid) from authenticated;
revoke all on function public.begin_certificate_job(uuid,jsonb,jsonb),public.finish_certificate_job(uuid,bigint),public.fail_certificate_job(uuid),public.expire_certificate_jobs() from public,anon;
grant execute on function public.begin_certificate_job(uuid,jsonb,jsonb),public.finish_certificate_job(uuid,bigint),public.fail_certificate_job(uuid),public.expire_certificate_jobs() to authenticated;
commit;
