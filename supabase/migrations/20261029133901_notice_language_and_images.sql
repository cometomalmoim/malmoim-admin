begin;
alter table public.board_posts add column language text not null default 'ko' check(language in ('ko','en')),add column images text[] not null default '{}' check(cardinality(images)<=4);
grant select(language,images) on public.board_posts to anon,authenticated;
create view public.public_notice_list with(security_invoker=true) as
 select id,title,content,language,images,category,status,is_pinned,created_at,updated_at,view_count
 from public.board_posts where category='notice' and status='public';
revoke all on public.public_notice_list from public,anon,authenticated;
grant select on public.public_notice_list to anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('announcement-images','announcement-images',false,4194304,array['image/webp']) on conflict(id) do nothing;
do $$begin if exists(select 1 from storage.buckets where id='announcement-images' and public) then raise exception 'Announcement bucket must be private';end if;end$$;
create policy notice_image_read on storage.objects for select to anon,authenticated using(bucket_id='announcement-images' and (public.member_board_admin() or exists(select 1 from public.board_posts p where p.category='notice' and p.status='public' and name=any(p.images))));
create policy notice_image_read_guard on storage.objects as restrictive for select to anon,authenticated using(bucket_id<>'announcement-images' or public.member_board_admin() or exists(select 1 from public.board_posts p where p.category='notice' and p.status='public' and name=any(p.images)));
create policy notice_image_insert on storage.objects for insert to authenticated with check(bucket_id='announcement-images' and public.member_board_admin() and split_part(name,'/',1)=auth.uid()::text);
create policy notice_image_insert_guard on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id<>'announcement-images' or (public.member_board_admin() and split_part(name,'/',1)=auth.uid()::text));
create policy notice_image_delete on storage.objects for delete to authenticated using(bucket_id='announcement-images' and public.member_board_admin() and not exists(select 1 from public.board_posts p where name=any(p.images)));
create policy notice_image_delete_guard on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'announcement-images' or (public.member_board_admin() and not exists(select 1 from public.board_posts p where name=any(p.images))));
create policy notice_image_no_update on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'announcement-images') with check(bucket_id<>'announcement-images');
grant usage on schema storage to anon,authenticated;
grant select on storage.objects to anon,authenticated;
grant insert,delete on storage.objects to authenticated;
create schema if not exists notice_private;
revoke all on schema notice_private from public,anon;
grant usage on schema notice_private to authenticated;
create function notice_private.save_notice(p_id uuid,p_version timestamptz,p_title text,p_content text,p_language text,p_images text[],p_nonce uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;existing public.board_posts;path text;
begin
 if auth.uid() is null or not public.member_board_admin() then raise exception 'Admin required' using errcode='42501';end if;
 if p_language is null or p_language not in ('ko','en') or p_images is null or cardinality(p_images)>4 or (select count(distinct x) from unnest(p_images) x)<>cardinality(p_images) then raise exception 'Invalid notice' using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,20261017));
 if p_id is null then
  if p_nonce is null then raise exception 'Missing nonce';end if;
  select * into existing from public.board_posts where author_id=auth.uid() and submission_id=p_nonce;
  if found then
   if existing.category='notice' and existing.title=btrim(p_title) and existing.content=btrim(p_content) and existing.language=p_language and existing.images=p_images then return existing.id;end if;
   raise exception 'Submission changed' using errcode='40001';
  end if;
 else
  select * into existing from public.board_posts where id=p_id for update;
  if not found or existing.category<>'notice' or existing.status='deleted' then raise exception 'Not found' using errcode='42501';end if;
 end if;
 foreach path in array p_images loop
  if path is null or path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$' or (not(path=any(coalesce(existing.images,'{}'::text[]))) and split_part(path,'/',1)<>auth.uid()::text) or not exists(select 1 from storage.objects where bucket_id='announcement-images' and name=path) then raise exception 'Invalid image' using errcode='23514';end if;
 end loop;
 result:=public.member_board_mutate('post_save',p_id,p_version,jsonb_build_object('category','notice','title',p_title,'content',p_content),p_nonce);
 update public.board_posts set language=p_language,images=p_images where id=result;
 return result;
end $$;
revoke all on function notice_private.save_notice(uuid,timestamptz,text,text,text,text[],uuid) from public,anon;
grant execute on function notice_private.save_notice(uuid,timestamptz,text,text,text,text[],uuid) to authenticated;
create function public.save_notice(p_id uuid,p_version timestamptz,p_title text,p_content text,p_language text,p_images text[],p_nonce uuid) returns uuid
language sql security invoker set search_path='' as $$select notice_private.save_notice(p_id,p_version,p_title,p_content,p_language,p_images,p_nonce)$$;
revoke all on function public.save_notice(uuid,timestamptz,text,text,text,text[],uuid) from public,anon;
grant execute on function public.save_notice(uuid,timestamptz,text,text,text,text[],uuid) to authenticated;
commit;
