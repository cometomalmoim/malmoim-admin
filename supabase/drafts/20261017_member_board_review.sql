-- MANUAL CANDIDATE: approval required before any remote execution.
-- Run preflight first; apply once as a reviewed BYPASSRLS migration owner.
-- Not an automatically deployed migration. No existing tables are overwritten.
-- Independent of internal_board_* and all event/member-profile tables.
begin;
do $preconditions$
begin
 if to_regclass('auth.users') is null or to_regprocedure('auth.uid()') is null or
    not exists(select 1 from pg_attribute where attrelid=to_regclass('public.admin_users') and attname='user_id' and atttypid='uuid'::regtype and not attisdropped)
 then raise exception 'Missing Auth/admin_users prerequisites';end if;
 if not exists(select 1 from pg_roles where rolname=current_user and (rolbypassrls or rolsuper))
 then raise exception 'A reviewed BYPASSRLS migration owner is required';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in ('board_posts','board_comments','board_reports','board_moderation_logs','board_aliases','board_view_days'))
 or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and starts_with(p.proname,'member_board_'))
 then raise exception 'Board objects already exist; stop and review metadata instead of recreating';end if;
end $preconditions$;
create table public.board_aliases(
 user_id uuid primary key references auth.users(id),
 nickname text not null unique default ('Member-'||substr(replace(gen_random_uuid()::text,'-',''),1,12))
);
create table public.board_posts(
 id uuid primary key default gen_random_uuid(), author_id uuid not null default auth.uid() references auth.users(id),
 author_name text not null default '', category text not null check(category in ('notice','free','question')),
 title text not null check(length(btrim(title)) between 1 and 200 and title ~ '[^[:space:]]'),
 content text not null check(length(btrim(content)) between 1 and 20000 and content ~ '[^[:space:]]'),
 status text not null default 'public' check(status in ('public','hidden','deleted')),
 is_pinned boolean not null default false,
 view_count bigint not null default 0 check(view_count>=0),
 submission_id uuid not null default gen_random_uuid(),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(author_id,submission_id)
);
create index board_posts_feed on public.board_posts(status,is_pinned desc,created_at desc,id);
create table public.board_comments(
 id uuid primary key default gen_random_uuid(),post_id uuid not null references public.board_posts(id),
 author_id uuid not null default auth.uid() references auth.users(id),author_name text not null default '',
 content text not null check(length(btrim(content)) between 1 and 2000 and content ~ '[^[:space:]]'),
 status text not null default 'public' check(status in ('public','hidden','deleted')),
 submission_id uuid not null default gen_random_uuid(),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(author_id,submission_id)
);
create index board_comments_post on public.board_comments(post_id,status,created_at,id);
create table public.board_reports(
 id uuid primary key default gen_random_uuid(),reporter_id uuid not null references auth.users(id),
 post_id uuid references public.board_posts(id),comment_id uuid references public.board_comments(id),
 reason text not null check(reason in ('spam','abuse','privacy','other')),
 detail text not null default '' check(length(detail)<=1000),
 original_content text not null check(length(original_content)<=20500),
 status text not null default 'pending' check(status in ('pending','reviewing','resolved')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((post_id is null)<>(comment_id is null)),unique(reporter_id,post_id),unique(reporter_id,comment_id)
);
create index board_reports_pending on public.board_reports(status,created_at);
create table public.board_moderation_logs(
 id uuid primary key default gen_random_uuid(),actor_id uuid not null references auth.users(id),
 post_id uuid references public.board_posts(id),comment_id uuid references public.board_comments(id),
 report_id uuid references public.board_reports(id),action text not null,reason text not null check(length(btrim(reason)) between 1 and 500),
 created_at timestamptz not null default now()
);
create table public.board_view_days(
 post_id uuid not null references public.board_posts(id),user_id uuid not null references auth.users(id),
 viewed_on date not null default ((now() at time zone 'Asia/Seoul')::date),primary key(post_id,user_id,viewed_on)
);
create function public.member_board_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.admin_users where user_id=auth.uid())
$$;
revoke all on function public.member_board_admin() from public;
grant execute on function public.member_board_admin() to anon,authenticated;

alter table public.board_aliases enable row level security;alter table public.board_aliases force row level security;
alter table public.board_posts enable row level security;alter table public.board_posts force row level security;
alter table public.board_comments enable row level security;alter table public.board_comments force row level security;
alter table public.board_reports enable row level security;alter table public.board_reports force row level security;
alter table public.board_moderation_logs enable row level security;alter table public.board_moderation_logs force row level security;
alter table public.board_view_days enable row level security;alter table public.board_view_days force row level security;
revoke all on public.board_aliases,public.board_posts,public.board_comments,public.board_reports,public.board_moderation_logs,public.board_view_days from public,anon,authenticated;
-- No public Auth UUIDs or profile fields. Public reads normally use the JSON RPC.
grant select(id,author_name,category,title,content,status,is_pinned,view_count,created_at,updated_at) on public.board_posts to anon,authenticated;
grant select(id,post_id,author_name,content,status,created_at,updated_at) on public.board_comments to anon,authenticated;
grant insert(category,title,content,submission_id),update(category,title,content) on public.board_posts to authenticated;
grant insert(post_id,content,submission_id),update(content) on public.board_comments to authenticated;
grant select on public.board_reports,public.board_moderation_logs to authenticated;
create policy member_board_read on public.board_posts for select to anon,authenticated using(status='public' or public.member_board_admin());
create policy member_board_insert on public.board_posts for insert to authenticated with check(author_id=auth.uid() and status='public' and not is_pinned and (category in ('free','question') or public.member_board_admin()));
create policy member_board_update on public.board_posts for update to authenticated using(author_id=auth.uid() and category in ('free','question') and status='public') with check(author_id=auth.uid() and category in ('free','question') and status='public');
create policy member_comment_read on public.board_comments for select to anon,authenticated using(public.member_board_admin() or (status='public' and exists(select 1 from public.board_posts p where p.id=post_id and p.status='public')));
create policy member_comment_insert on public.board_comments for insert to authenticated with check(author_id=auth.uid() and status='public' and exists(select 1 from public.board_posts p where p.id=post_id and p.status='public'));
create policy member_comment_update on public.board_comments for update to authenticated using(author_id=auth.uid() and status='public' and exists(select 1 from public.board_posts p where p.id=post_id and p.status='public')) with check(author_id=auth.uid() and status='public' and exists(select 1 from public.board_posts p where p.id=post_id and p.status='public'));
create policy member_report_admin_read on public.board_reports for select to authenticated using(public.member_board_admin());
create policy member_log_admin_read on public.board_moderation_logs for select to authenticated using(public.member_board_admin());
-- Physical DELETE is unavailable. Soft deletion goes through the verified RPC.
create function public.member_board_protect() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.author_id is distinct from auth.uid() then raise exception 'Forbidden' using errcode='42501';end if;
  if tg_table_name='board_posts' and (select count(*) from public.board_posts where author_id=auth.uid() and created_at>now()-interval '1 minute')>=10 then raise exception 'Rate limited' using errcode='P0003';end if;
  if tg_table_name='board_comments' and (select count(*) from public.board_comments where author_id=auth.uid() and created_at>now()-interval '1 minute')>=50 then raise exception 'Rate limited' using errcode='P0003';end if;
  insert into public.board_aliases(user_id) values(auth.uid()) on conflict do nothing;
  select nickname into new.author_name from public.board_aliases where user_id=auth.uid();
  new.created_at:=clock_timestamp();new.updated_at:=new.created_at;
 else
  if new.id<>old.id or new.author_id<>old.author_id or new.author_name<>old.author_name or new.created_at<>old.created_at or new.submission_id<>old.submission_id then
   raise exception 'Protected fields' using errcode='42501';
  end if;
  if tg_table_name='board_comments' then
   if new.post_id<>old.post_id then raise exception 'Protected parent' using errcode='42501';end if;
   new.updated_at:=clock_timestamp();
  elsif (new.title,new.content,new.category,new.status,new.is_pinned) is distinct from (old.title,old.content,old.category,old.status,old.is_pinned) then
   new.updated_at:=clock_timestamp();
  else new.updated_at:=old.updated_at;
  end if;
 end if;
 return new;
end $$;
revoke all on function public.member_board_protect() from public,anon,authenticated;
create trigger board_posts_protect before insert or update on public.board_posts for each row execute function public.member_board_protect();
create trigger board_comments_protect before insert or update on public.board_comments for each row execute function public.member_board_protect();

create function public.member_board_can_change(p_kind text,p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select case when p_kind='post' then exists(select 1 from public.board_posts where id=p_id and ((status='public' and author_id=auth.uid() and category in ('free','question')) or (status<>'deleted' and category='notice' and public.member_board_admin())))
 when p_kind='comment' then exists(select 1 from public.board_comments c join public.board_posts p on p.id=c.post_id where c.id=p_id and c.author_id=auth.uid() and c.status='public' and p.status='public') else false end
$$;
revoke all on function public.member_board_can_change(text,uuid) from public,anon,authenticated;
grant execute on function public.member_board_can_change(text,uuid) to authenticated;

create function public.member_board_mutate(p_action text,p_id uuid default null,p_version timestamptz default null,p_input jsonb default '{}',p_nonce uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); adm boolean:=public.member_board_admin();p public.board_posts;c public.board_comments;r public.board_reports;
 result uuid; parent uuid; target_status text; why text;
begin
 if uid is null then raise exception 'Login required' using errcode='42501';end if;
 if p_action not in ('post_save','post_delete','comment_save','comment_delete','report','hide_post','show_post','hide_comment','show_comment','pin','report_review','view') or p_action is null then raise exception 'Invalid operation';end if;
 if jsonb_typeof(p_input) is distinct from 'object' then raise exception 'Invalid input';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,20261017));
 if p_action in ('post_save','post_delete','hide_post','show_post','pin','view') and p_id is not null then
  select * into p from public.board_posts where id=p_id for update;
  if not found then raise exception 'Not found' using errcode='P0002';end if;
 elsif p_action in ('comment_save','comment_delete','hide_comment','show_comment') and p_id is not null then
  select * into c from public.board_comments where id=p_id for update;
  if not found then raise exception 'Not found' using errcode='P0002';end if;
  select * into p from public.board_posts where id=c.post_id for update;
 end if;
 if p_action='view' then
  if p.id is null or p.status<>'public' then raise exception 'Not found';end if;
  insert into public.board_view_days(post_id,user_id) values(p.id,uid) on conflict do nothing;
  if found then update public.board_posts set view_count=view_count+1 where id=p.id;end if;return p.id;
 end if;
 if p_action in ('post_save','post_delete') then
  if p_id is not null then
   if not public.member_board_can_change('post',p_id) then raise exception 'Forbidden' using errcode='42501';end if;
   if p.updated_at is distinct from p_version then raise exception 'Stale version' using errcode='40001';end if;
  elsif p_action='post_delete' then raise exception 'Missing id';end if;
  if p_action='post_delete' then
   update public.board_posts set status='deleted',is_pinned=false where id=p.id;
   if adm and p.category='notice' then insert into public.board_moderation_logs(actor_id,post_id,action,reason) values(uid,p.id,'notice_delete','공지사항 삭제');end if;
   return p.id;
  end if;
  if p_input->>'category' not in ('free','question','notice') or p_input->>'category' is null then raise exception 'Invalid category';end if;
  if p_input->>'category'='notice' and not adm then raise exception 'Forbidden notice' using errcode='42501';end if;
  if p_id is not null and ((p.category='notice')<>(p_input->>'category'='notice')) then raise exception 'Cannot convert notice';end if;
  if p_id is null then
   if p_nonce is null then raise exception 'Missing submission id';end if;
   select id into result from public.board_posts where author_id=uid and submission_id=p_nonce;
   if result is not null then return result;end if;
   if (select count(*) from public.board_posts where author_id=uid and created_at>now()-interval '1 minute')>=10 then raise exception 'Rate limited' using errcode='P0003';end if;
   insert into public.board_posts(category,title,content,submission_id) values(p_input->>'category',btrim(p_input->>'title'),btrim(p_input->>'content'),p_nonce) returning id into result;
  else
   update public.board_posts set category=p_input->>'category',title=btrim(p_input->>'title'),content=btrim(p_input->>'content') where id=p.id;
   result:=p.id;
  end if;
  if adm and p_input->>'category'='notice' then insert into public.board_moderation_logs(actor_id,post_id,action,reason) values(uid,result,'notice_save','공지사항 저장');end if;
  return result;
 elsif p_action in ('comment_save','comment_delete') then
  if p_id is not null then
   if not public.member_board_can_change('comment',p_id) then raise exception 'Forbidden' using errcode='42501';end if;
   if c.updated_at is distinct from p_version then raise exception 'Stale version' using errcode='40001';end if;
   if p_action='comment_delete' then update public.board_comments set status='deleted' where id=c.id;
   else update public.board_comments set content=btrim(p_input->>'content') where id=c.id;end if;
   return c.post_id;
  end if;
  if p_action='comment_delete' then raise exception 'Missing id';end if;
  parent:=(p_input->>'post_id')::uuid;
  select * into p from public.board_posts where id=parent and status='public' for update;
  if not found then raise exception 'Not found';end if;
  if p_nonce is null then raise exception 'Missing submission id';end if;
  if exists(select 1 from public.board_comments where author_id=uid and submission_id=p_nonce and post_id<>parent) then raise exception 'Invalid submission';end if;
  if (select count(*) from public.board_comments where author_id=uid and created_at>now()-interval '1 minute')>=50 then raise exception 'Rate limited' using errcode='P0003';end if;
  insert into public.board_comments(post_id,content,submission_id) values(parent,btrim(p_input->>'content'),p_nonce) on conflict(author_id,submission_id) do nothing;
  return parent;
 elsif p_action='report' then
  if p_input->>'target'='post' then
   select id into parent from public.board_posts where id=p_id and status='public';
   if parent is null then raise exception 'Not found';end if;
   insert into public.board_reports(reporter_id,post_id,reason,detail,original_content) select uid,parent,p_input->>'reason',coalesce(p_input->>'detail',''),title||E'\n'||content from public.board_posts where id=parent;
  elsif p_input->>'target'='comment' then
   select c2.post_id into parent from public.board_comments c2 join public.board_posts p2 on p2.id=c2.post_id where c2.id=p_id and c2.status='public' and p2.status='public';
   if parent is null then raise exception 'Not found';end if;
   insert into public.board_reports(reporter_id,comment_id,reason,detail,original_content) select uid,p_id,p_input->>'reason',coalesce(p_input->>'detail',''),content from public.board_comments where id=p_id;
  else raise exception 'Invalid target';end if;return parent;
 end if;
 if not adm then raise exception 'Admin required' using errcode='42501';end if;
 why:=btrim(p_input->>'reason');
 if why is null or length(why) not between 1 and 500 then raise exception 'Reason required';end if;
 if p_action='report_review' then
  select * into r from public.board_reports where id=p_id for update;
  if not found then raise exception 'Not found';end if;
  if r.updated_at is distinct from p_version then raise exception 'Stale version' using errcode='40001';end if;
  if p_input->>'status' not in ('reviewing','resolved') or p_input->>'status' is null then raise exception 'Invalid status';end if;
  update public.board_reports set status=p_input->>'status',updated_at=clock_timestamp() where id=r.id;
  insert into public.board_moderation_logs(actor_id,post_id,comment_id,report_id,action,reason) values(uid,r.post_id,r.comment_id,r.id,'report_'||(p_input->>'status'),why);
  select coalesce(r.post_id,(select post_id from public.board_comments where id=r.comment_id)) into parent;
  return parent;
 elsif p_action in ('hide_post','show_post','pin') then
  if p.id is null or p.status='deleted' then raise exception 'Not found';end if;
  if p.updated_at is distinct from p_version then raise exception 'Stale version' using errcode='40001';end if;
  if p_action='pin' then
   update public.board_posts set is_pinned=coalesce((p_input->>'is_pinned')::boolean,false) where id=p.id;
  else update public.board_posts set status=case when p_action='hide_post' then 'hidden' else 'public' end where id=p.id;end if;
  insert into public.board_moderation_logs(actor_id,post_id,action,reason) values(uid,p.id,p_action,why);return p.id;
 elsif p_action in ('hide_comment','show_comment') then
  if c.id is null or c.status='deleted' then raise exception 'Not found';end if;
  if c.updated_at is distinct from p_version then raise exception 'Stale version' using errcode='40001';end if;
  update public.board_comments set status=case when p_action='hide_comment' then 'hidden' else 'public' end where id=c.id;
  insert into public.board_moderation_logs(actor_id,comment_id,action,reason) values(uid,c.id,p_action,why);return c.post_id;
 end if;
 raise exception 'Unsupported operation';
end $$;
revoke all on function public.member_board_mutate(text,uuid,timestamptz,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.member_board_mutate(text,uuid,timestamptz,jsonb,uuid) to authenticated;

create function public.member_board_post_json(p public.board_posts,p_admin boolean default false) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'category',p.category,'title',p.title,'content',p.content,'author_name',p.author_name,
 'created_at',p.created_at,'updated_at',p.updated_at,'view_count',p.view_count,'is_pinned',p.is_pinned,'status',p.status,
 'can_edit',((p.author_id=auth.uid() and p.category<>'notice' and p.status='public') or (p_admin and public.member_board_admin() and p.category='notice' and p.status<>'deleted')),
 'comment_count',(select count(*) from public.board_comments c where c.post_id=p.id and (c.status='public' or (p_admin and public.member_board_admin()))),
 'report_count',case when p_admin and public.member_board_admin() then (select count(*) from public.board_reports r where r.post_id=p.id or r.comment_id in(select id from public.board_comments where post_id=p.id)) else null end)
$$;
revoke all on function public.member_board_post_json(public.board_posts,boolean) from public,anon,authenticated;

create function public.member_board_list(p_filter jsonb default '{}',p_admin boolean default false) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare selected_category text:=coalesce(p_filter->>'category','all'); scope text:=coalesce(p_filter->>'scope','all');
 period text:=coalesce(p_filter->>'period','all');visibility text:=coalesce(p_filter->>'status','all');
 term text:=lower(btrim(coalesce(p_filter->>'q',''))); page_no integer:=greatest(1,least(coalesce((p_filter->>'page')::integer,1),10000));
 author_term text:=lower(btrim(coalesce(p_filter->>'author',''))); pin_filter text:=coalesce(p_filter->>'pinned','all');
 cutoff timestamptz; rows jsonb; total bigint; words jsonb;
begin
 if p_admin and not public.member_board_admin() then raise exception 'Admin required' using errcode='42501';end if;
 if selected_category not in ('all','notice','free','question') or scope not in ('all','title','author','comments') or period not in ('all','day','week','month','quarter','year') or visibility not in ('all','public','hidden','deleted','reported') or length(term)>100 or length(author_term)>100 or pin_filter not in ('all','pinned','unpinned') then raise exception 'Invalid filters';end if;
 cutoff:=case period when 'day' then now()-interval '1 day' when 'year' then now()-interval '1 year' when 'week' then now()-interval '7 days' when 'month' then now()-interval '1 month' when 'quarter' then now()-interval '3 months' else '-infinity'::timestamptz end;
 with filtered as (
 select p.* from public.board_posts p where (p_admin or p.status='public') and
 (selected_category='all' or p.category=selected_category) and p.created_at>=cutoff and
 (not p_admin or author_term='' or strpos(lower(p.author_name),author_term)>0) and
 (not p_admin or pin_filter='all' or p.is_pinned=(pin_filter='pinned')) and
 (not p_admin or visibility='all' or p.status=visibility or
  (visibility='reported' and exists(select 1 from public.board_reports r where r.status in ('pending','reviewing') and (r.post_id=p.id or r.comment_id in(select id from public.board_comments where post_id=p.id))))) and
 (term='' or (scope in ('all','title') and strpos(lower(p.title),term)>0) or
 (scope='all' and strpos(lower(p.content),term)>0) or
 (scope='author' and strpos(lower(p.author_name),term)>0) or
 (scope in ('all','comments') and exists(select 1 from public.board_comments c where c.post_id=p.id and (p_admin or c.status='public') and strpos(lower(c.content),term)>0)))
 ), selected as (select * from filtered order by is_pinned desc,created_at desc,id desc offset (page_no-1)*20 limit 20)
 select (select count(*) from filtered),coalesce((select jsonb_agg(public.member_board_post_json((select bp from public.board_posts bp where bp.id=s.id),p_admin) order by s.is_pinned desc,s.created_at desc,s.id desc) from selected s),'[]'::jsonb) into total,rows;
 -- Conservative safe vocabulary: arbitrary names/handles/phone/email/profanity can
 -- never become hot keywords. Count distinct public posts, not repeated spam words.
 with recent as (select id,title,content from public.board_posts where status='public' and created_at>=now()-interval '7 days' order by created_at desc limit 500),
 tokens as (select distinct r.id,lower(t.word) word from recent r cross join lateral regexp_split_to_table(r.title||' '||r.content,'[^[:alpha:]]+') t(word)),
 ranked as (select word,count(*) hits from tokens where word=any(array['한국어','영어','일본어','중국어','프랑스어','스페인어','언어','질문','문법','회화','공부','문화','교환','스터디','발음','독서','학습','번역','영어회화','언어교환','독일어','교재추천','오프라인모임','자기소개','german','korean','english','japanese','chinese','french','spanish','language','question','grammar','conversation','study','culture','exchange','pronunciation','reading','learning','translation']) group by word order by hits desc,word limit 10)
 select coalesce(jsonb_agg(jsonb_build_object('word',word,'count',hits) order by hits desc,word),'[]'::jsonb) into words from ranked;
 return jsonb_build_object('posts',rows,'total',total,'page',page_no,'keywords',words,
 'authenticated',auth.uid() is not null,'admin',public.member_board_admin(),
 'stats',case when p_admin then jsonb_build_object('total',(select count(*) from public.board_posts),'hidden',(select count(*) from public.board_posts where status='hidden'),'reports',(select count(*) from public.board_reports where status in ('pending','reviewing'))) else null end);
end $$;
revoke all on function public.member_board_list(jsonb,boolean) from public,anon,authenticated;
grant execute on function public.member_board_list(jsonb,boolean) to anon,authenticated;

create function public.member_board_detail(p_id uuid,p_admin boolean default false,p_page integer default 1,p_query text default '') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.board_posts;comments jsonb;reports jsonb;logs jsonb;total bigint;
begin
 if p_admin and not public.member_board_admin() then raise exception 'Admin required' using errcode='42501';end if;
 if p_page not between 1 and 10000 or length(p_query)>100 then raise exception 'Invalid query';end if;
 select * into p from public.board_posts where id=p_id and (p_admin or status='public');
 if not found then return null;end if;
 with filtered as (select * from public.board_comments where post_id=p.id and (p_admin or status='public') and (p_query='' or strpos(lower(content),lower(p_query))>0)),
 selected as (select * from filtered order by created_at,id offset (p_page-1)*30 limit 30)
 select (select count(*) from filtered),coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'post_id',s.post_id,'content',s.content,'author_name',s.author_name,'created_at',s.created_at,'updated_at',s.updated_at,'status',s.status,'can_edit',s.author_id=auth.uid() and s.status='public' and p.status='public') order by s.created_at,s.id) from selected s),'[]'::jsonb) into total,comments;
 if p_admin then
  select coalesce(jsonb_agg(to_jsonb(r)-'reporter_id' order by r.created_at desc),'[]'::jsonb) into reports from public.board_reports r where r.post_id=p.id or r.comment_id in(select id from public.board_comments where post_id=p.id);
  select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at desc),'[]'::jsonb) into logs from public.board_moderation_logs l where l.post_id=p.id or l.comment_id in(select id from public.board_comments where post_id=p.id);
 end if;
 return jsonb_build_object('post',public.member_board_post_json(p,p_admin),'comments',comments,'comment_total',total,'comment_page',p_page,
 'reports',reports,'logs',logs,'authenticated',auth.uid() is not null,'admin',public.member_board_admin());
end $$;
revoke all on function public.member_board_detail(uuid,boolean,integer,text) from public,anon,authenticated;
grant execute on function public.member_board_detail(uuid,boolean,integer,text) to anon,authenticated;
commit;
