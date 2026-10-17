-- PROPOSAL ONLY. Review and approve before applying to the intended project.
-- New objects only; do not run if these names already exist without inspection.
begin;
create table public.history_reviews (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '익명' check (char_length(display_name) between 1 and 60),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  category text not null check (category in ('regular','special','other')),
  content text not null check (char_length(btrim(content)) between 1 and 10000),
  photo_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint history_review_photo_count check (cardinality(photo_paths) <= 3 and array_position(photo_paths, null) is null)
);
create index history_reviews_order on public.history_reviews (created_at desc, id desc);
create index history_reviews_category_order on public.history_reviews (category, created_at desc, id desc);
create function public.validate_history_review() returns trigger
language plpgsql set search_path = '' as $$
declare photo text;
begin
  if TG_OP = 'UPDATE' then
    if new.author_id is distinct from old.author_id or new.id is distinct from old.id or new.created_at is distinct from old.created_at or new.display_name is distinct from old.display_name then
      raise exception 'Review identity is immutable';
    end if;
  else
    new.created_at := now();
  end if;
  new.updated_at := now();
  foreach photo in array new.photo_paths loop
    if photo not like new.author_id::text || '/' || new.id::text || '/%' or photo !~ '^[0-9a-f-]+/[0-9a-f-]+/[0-9a-f-]+\.(jpg|png|webp)$' then
      raise exception 'Invalid photo ownership path';
    end if;
  end loop;
  return new;
end $$;
create trigger validate_history_review before insert or update on public.history_reviews for each row execute function public.validate_history_review();
revoke all on public.history_reviews from anon, authenticated;
grant select on public.history_reviews to anon, authenticated;
grant insert (id,author_id,display_name,title,category,content,photo_paths) on public.history_reviews to authenticated;
grant update (title,category,content,photo_paths) on public.history_reviews to authenticated;
grant delete on public.history_reviews to authenticated;
alter table public.history_reviews enable row level security;
create policy history_reviews_read on public.history_reviews for select to anon, authenticated using (true);
create policy history_reviews_create on public.history_reviews for insert to authenticated with check ((select auth.uid()) = author_id);
create policy history_reviews_edit on public.history_reviews for update to authenticated using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);
create policy history_reviews_delete on public.history_reviews for delete to authenticated using ((select auth.uid()) = author_id);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('history-review-photos','history-review-photos',false,204800,array['image/jpeg','image/png','image/webp']);
-- No alterations to storage.objects RLS or other buckets/policies.
create policy history_review_photos_read on storage.objects for select to anon, authenticated using (
  bucket_id = 'history-review-photos' and (
    (storage.foldername(name))[1] = (select auth.uid())::text or
    exists (select 1 from public.history_reviews r where storage.objects.name = any(r.photo_paths))
  )
);
create policy history_review_photos_create on storage.objects for insert to authenticated with check (
  bucket_id = 'history-review-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~ '^[0-9a-f-]+/[0-9a-f-]+/[0-9a-f-]+\.(jpg|png|webp)$'
);
create policy history_review_photos_delete on storage.objects for delete to authenticated using (
  bucket_id = 'history-review-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
);
commit;
