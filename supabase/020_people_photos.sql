-- Apply after 019. Keep profile images private to administrators.
begin;
alter table public.people drop constraint people_photo_url_check;
alter table public.people add constraint people_photo_url_check check (
 length(photo_url)<=2000 and (photo_url='' or photo_url ~ '^https://' or photo_url ~ '^/api/admin/people/photos/[0-9a-f-]{36}\.(jpg|png|webp)$')
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('people-photos','people-photos',false,3145728,array['image/jpeg','image/png','image/webp']);
create policy people_photos_read on storage.objects for select to authenticated using(bucket_id='people-photos' and exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy people_photos_insert on storage.objects for insert to authenticated with check(bucket_id='people-photos' and exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy people_photos_delete on storage.objects for delete to authenticated using(bucket_id='people-photos' and exists(select 1 from public.admin_users where user_id=(select auth.uid())));
commit;
