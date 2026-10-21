-- Read-only privilege/metadata assertions; no member content or accounts queried.
-- Run after reviewing/applying the draft in an isolated test DB. No migration applied here.
begin;
do $$
declare table_name text;
begin
 foreach table_name in array array['board_posts','board_comments','board_reports','board_moderation_logs','board_aliases','board_view_days'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=table_name and c.relrowsecurity and c.relforcerowsecurity) then
   raise exception 'Missing forced RLS on %',table_name;
  end if;
 end loop;
 if has_column_privilege('anon','public.board_posts','author_id','SELECT') or
    has_column_privilege('authenticated','public.board_posts','author_id','UPDATE') or
    has_column_privilege('authenticated','public.board_posts','status','UPDATE') or
    has_column_privilege('authenticated','public.board_posts','is_pinned','UPDATE') or
    has_column_privilege('authenticated','public.board_posts','view_count','UPDATE') or
    has_column_privilege('authenticated','public.board_comments','post_id','UPDATE') then
  raise exception 'Protected columns exposed';
 end if;
 if has_table_privilege('authenticated','public.board_posts','DELETE') or
    has_table_privilege('authenticated','public.board_moderation_logs','INSERT') or
    has_table_privilege('authenticated','public.board_moderation_logs','UPDATE') or
    has_table_privilege('authenticated','public.board_reports','UPDATE') then
  raise exception 'Unauthorized direct write grant';
 end if;
 if has_function_privilege('anon','public.member_board_can_change(text,uuid)','EXECUTE') then raise exception 'Anonymous can execute owner RPC';end if;
 if has_function_privilege('anon','public.member_board_mutate(text,uuid,timestamptz,jsonb,uuid)','EXECUTE') then
  raise exception 'Anonymous can execute mutation RPC';
 end if;
end $$;
rollback;
