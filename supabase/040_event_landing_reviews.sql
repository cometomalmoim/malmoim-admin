begin;
create table public.event_landing_reviews (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.recruitment_events(id) on delete restrict,
 display_name text not null default '익명' check(char_length(btrim(display_name)) between 1 and 60),
 locale text not null check(locale in ('ko','en')),
 body text not null check(char_length(btrim(body)) between 1 and 1000),
 source_note text not null default '' check(char_length(source_note)<=500),
 sort_order integer not null default 0 check(sort_order between 0 and 9999),
 published boolean not null default false,
 publication_confirmed boolean not null default false,
 revision integer not null default 0,
 updated_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(not published or publication_confirmed)
);
create index on public.event_landing_reviews(event_id,sort_order,created_at,id);
alter table public.event_landing_reviews enable row level security;
alter table public.event_landing_reviews force row level security;
revoke all on public.event_landing_reviews from public,anon,authenticated;
grant select on public.event_landing_reviews to authenticated;
create policy "Admins read landing reviews" on public.event_landing_reviews for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create function public.public_event_reviews(p_slug text) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'display_name',r.display_name,'locale',r.locale,'body',r.body) order by r.sort_order,r.created_at,r.id),'[]'::jsonb)
 from public.event_landing_reviews r join public.recruitment_events e on e.id=r.event_id
 where e.slug=p_slug and e.status in ('published','closed') and not e.is_test and not e.is_archived and r.published and r.publication_confirmed;
$$;
create function public.save_event_review(p_event uuid,p_id uuid,p_revision integer,p_name text,p_locale text,p_body text,p_note text,p_order integer,p_published boolean,p_confirmed boolean) returns text language plpgsql security definer set search_path='' as $$
declare row public.event_landing_reviews;
begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid()) then return 'forbidden'; end if;
 if p_name is null or char_length(btrim(p_name)) not between 1 and 60 or p_locale is null or p_locale not in ('ko','en') or p_body is null or char_length(btrim(p_body)) not between 1 and 1000 or p_note is null or char_length(p_note)>500 or p_order is null or p_order not between 0 and 9999 or p_published is null or p_confirmed is null or (p_published and not p_confirmed) then return 'invalid'; end if;
 if not exists(select 1 from public.recruitment_events where id=p_event) then return 'missing'; end if;
 select * into row from public.event_landing_reviews where id=p_id for update;
 if found then
  if row.event_id<>p_event or p_revision is null or row.revision<>p_revision then return 'stale'; end if;
  update public.event_landing_reviews set display_name=btrim(p_name),locale=p_locale,body=btrim(p_body),source_note=p_note,sort_order=p_order,published=p_published,publication_confirmed=p_confirmed,revision=revision+1,updated_by=auth.uid(),updated_at=now() where id=p_id;
 else
  if p_id is null or p_revision is distinct from 0 then return 'invalid'; end if;
  insert into public.event_landing_reviews(id,event_id,display_name,locale,body,source_note,sort_order,published,publication_confirmed,updated_by) values(p_id,p_event,btrim(p_name),p_locale,btrim(p_body),p_note,p_order,p_published,p_confirmed,auth.uid());
 end if;
 return 'saved';
end $$;
revoke all on function public.public_event_reviews(text),public.save_event_review(uuid,uuid,integer,text,text,text,text,integer,boolean,boolean) from public,anon,authenticated;
grant execute on function public.public_event_reviews(text) to anon,authenticated;
grant execute on function public.save_event_review(uuid,uuid,integer,text,text,text,text,integer,boolean,boolean) to authenticated;
commit;
