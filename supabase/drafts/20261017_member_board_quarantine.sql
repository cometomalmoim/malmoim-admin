-- MANUAL / APPROVAL REQUIRED. Emergency access quarantine, not destructive rollback.
-- Only after this exact board migration has been applied and a backup is verified.
-- Preserves all six tables, rows, FK constraints, RLS policies and audit records.
begin;
do $$
declare t text; cols text; f record;
begin
 foreach t in array array['board_posts','board_comments','board_reports','board_moderation_logs','board_aliases','board_view_days'] loop
  if to_regclass('public.'||t) is null then raise exception 'Expected board table missing: %',t;end if;
  execute format('revoke all on table public.%I from public,anon,authenticated',t);
  select string_agg(quote_ident(attname),',') into cols from pg_attribute
   where attrelid=to_regclass('public.'||t) and attnum>0 and not attisdropped;
  -- Table REVOKE alone does not remove independent column grants.
  execute format('revoke select (%s),insert (%s),update (%s),references (%s) on public.%I from public,anon,authenticated',cols,cols,cols,cols,t);
 end loop;
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('member_board_admin','member_board_protect','member_board_can_change','member_board_mutate','member_board_post_json','member_board_list','member_board_detail')
 loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;
end $$;
commit;
-- Recovery requires reviewed grants from the approved migration and access tests.
-- Never re-run the CREATE migration over existing tables. No DROP/CASCADE here.
