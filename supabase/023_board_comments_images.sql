begin;
alter table public.internal_board_posts add column images text[] not null default '{}' check(cardinality(images)<=4);
alter table public.internal_board_comments add column updated_at timestamptz not null default now();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('board-images','board-images',false,3145728,array['image/jpeg','image/png','image/webp']);
create policy board_images_read on storage.objects for select to authenticated using(bucket_id='board-images' and exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy board_images_insert on storage.objects for insert to authenticated with check(bucket_id='board-images' and split_part(name,'/',1)=(select auth.uid())::text and exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy board_images_delete on storage.objects for delete to authenticated using(bucket_id='board-images' and split_part(name,'/',1)=(select auth.uid())::text and not exists(select 1 from public.internal_board_posts where name=any(images)) and exists(select 1 from public.admin_users where user_id=(select auth.uid())));
-- Preserve the existing post validation and locking behind an extended transactional entry point.
alter function public.manage_internal_board(text,uuid,timestamptz,jsonb) rename to manage_internal_board_core;
revoke all on function public.manage_internal_board_core(text,uuid,timestamptz,jsonb) from public,anon,authenticated;
create function public.manage_internal_board(p_kind text,p_id uuid,p_updated_at timestamptz,p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare result_id uuid; paths text[]; old_paths text[]; path text; c public.internal_board_comments;
begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Forbidden'; end if;
 if p_kind in ('comment_edit','comment_delete') then
  select * into c from public.internal_board_comments where id=p_id for update;
  if not found or c.author_id<>auth.uid() or c.updated_at is distinct from p_updated_at then raise exception 'Forbidden or stale comment'; end if;
  if p_kind='comment_delete' then delete from public.internal_board_comments where id=p_id;
  else update public.internal_board_comments set body=btrim(p_input->>'body'),updated_at=clock_timestamp() where id=p_id; end if;
  return c.post_id;
 end if;
 if p_kind='save' then
  if p_id is not null then select images into old_paths from public.internal_board_posts where id=p_id for update; end if;
  if p_input ? 'images' then
   if jsonb_typeof(p_input->'images')<>'array' or jsonb_array_length(p_input->'images')>4 then raise exception 'Invalid images'; end if;
   select coalesce(array_agg(value),'{}') into paths from jsonb_array_elements_text(p_input->'images');
  else paths:=coalesce(old_paths,'{}'); end if;
  foreach path in array paths loop
   if path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$' or not exists(select 1 from storage.objects where bucket_id='board-images' and name=path) or (split_part(path,'/',1)<>auth.uid()::text and not(path=any(coalesce(old_paths,'{}')))) then raise exception 'Invalid image ownership'; end if;
  end loop;
 end if;
 result_id:=public.manage_internal_board_core(p_kind,p_id,p_updated_at,p_input);
 if p_kind='save' then update public.internal_board_posts set images=paths where id=result_id; end if;
 return result_id;
end $$;
revoke all on function public.manage_internal_board(text,uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.manage_internal_board(text,uuid,timestamptz,jsonb) to authenticated;
commit;
