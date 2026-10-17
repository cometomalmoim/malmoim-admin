begin;
create table public.internal_board_posts (
 id uuid primary key default gen_random_uuid(), author_id uuid not null references auth.users(id),
 author_name text not null, title text not null check(length(btrim(title)) between 1 and 200),
 body text not null check(length(btrim(body)) between 1 and 20000),
 category text not null check(category in ('공지','자유','행사','시스템')),
 is_pinned boolean not null default false check(not is_pinned or category='공지'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index internal_board_order on public.internal_board_posts(is_pinned desc,created_at desc);
create table public.internal_board_comments (
 id uuid primary key default gen_random_uuid(), post_id uuid not null references public.internal_board_posts(id) on delete cascade,
 author_id uuid not null references auth.users(id), author_name text not null,
 body text not null check(length(btrim(body)) between 1 and 5000), created_at timestamptz not null default now()
);
create index internal_board_comment_post on public.internal_board_comments(post_id,created_at);
alter table public.internal_board_posts enable row level security;
alter table public.internal_board_posts force row level security;
alter table public.internal_board_comments enable row level security;
alter table public.internal_board_comments force row level security;
revoke all on public.internal_board_posts,public.internal_board_comments from public,anon,authenticated;
grant select on public.internal_board_posts,public.internal_board_comments to authenticated;
create policy board_admin_read on public.internal_board_posts for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy board_comment_admin_read on public.internal_board_comments for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create function public.manage_internal_board(p_kind text,p_id uuid,p_updated_at timestamptz,p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare current_row public.internal_board_posts; result_id uuid; author_label text;
begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Forbidden'; end if;
 if p_kind is null or p_kind not in ('save','delete','pin','comment') then raise exception 'Invalid operation'; end if;
 select coalesce(nullif(raw_user_meta_data->>'name',''),email,'운영진') into author_label from auth.users where id=auth.uid();
 if p_id is not null then
  select * into current_row from public.internal_board_posts where id=p_id for update;
  if not found then raise exception 'Missing post'; end if;
  if p_kind<>'comment' and (current_row.author_id<>auth.uid() or current_row.updated_at is distinct from p_updated_at) then raise exception 'Forbidden or stale post'; end if;
 elsif p_kind<>'save' then raise exception 'Missing post'; end if;
 if p_kind='comment' then
  insert into public.internal_board_comments(post_id,author_id,author_name,body) values(p_id,auth.uid(),author_label,btrim(p_input->>'body'));
  return p_id;
 elsif p_kind='delete' then
  delete from public.internal_board_posts where id=p_id; return p_id;
 elsif p_kind='pin' then
  if current_row.category<>'공지' then raise exception 'Only notices may be pinned'; end if;
  update public.internal_board_posts set is_pinned=(p_input->>'is_pinned')::boolean,updated_at=clock_timestamp() where id=p_id; return p_id;
 end if;
 result_id:=coalesce(p_id,gen_random_uuid());
 if p_id is null then
  insert into public.internal_board_posts(id,author_id,author_name,title,body,category,is_pinned)
  values(result_id,auth.uid(),author_label,btrim(p_input->>'title'),btrim(p_input->>'body'),p_input->>'category',case when p_input->>'category'='공지' then coalesce((p_input->>'is_pinned')::boolean,false) else false end);
 else
  update public.internal_board_posts set title=btrim(p_input->>'title'),body=btrim(p_input->>'body'),category=p_input->>'category',is_pinned=case when p_input->>'category'='공지' then coalesce((p_input->>'is_pinned')::boolean,false) else false end,updated_at=clock_timestamp() where id=p_id;
 end if;
 return result_id;
end $$;
revoke all on function public.manage_internal_board(text,uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.manage_internal_board(text,uuid,timestamptz,jsonb) to authenticated;
commit;
