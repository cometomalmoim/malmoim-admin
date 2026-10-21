-- Metadata only. Run in the intended Supabase SQL editor; no member rows read.
begin transaction read only;
select current_user as execution_role, rolbypassrls, rolsuper
from pg_roles where rolname=current_user;
select to_regclass('auth.users') is not null as auth_users_present,
 to_regprocedure('auth.uid()') is not null as auth_uid_present,
 to_regclass('public.admin_users') is not null as admin_users_present,
 to_regclass('supabase_migrations.schema_migrations') is not null as migration_history_present;
select n.nspname,c.relname,c.relkind,pg_get_userbyid(c.relowner) as owner,
 c.relrowsecurity,c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and (c.relname in
 ('board_posts','board_comments','board_reports','board_moderation_logs','board_aliases','board_view_days','admin_users')
 or c.relname like 'internal_board_%') order by c.relname;
select c.relname,a.attname,format_type(a.atttypid,a.atttypmod) as data_type,a.attnotnull
from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('admin_users','board_posts','board_comments','board_reports','board_moderation_logs','board_aliases','board_view_days')
 and a.attnum>0 and not a.attisdropped order by c.relname,a.attnum;
select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
 pg_get_userbyid(p.proowner) as owner,r.rolbypassrls,r.rolsuper,
 p.prosecdef,p.proconfig,p.proacl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner
where n.nspname='public' and starts_with(p.proname,'member_board_') order by p.proname;
select tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename in ('board_posts','board_comments','board_reports','board_moderation_logs','board_aliases','board_view_days')
order by tablename,policyname;
select c.relname,con.conname,pg_get_constraintdef(con.oid) as definition
from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('board_posts','board_comments','board_reports','board_moderation_logs','board_aliases','board_view_days');
select tablename,indexname,indexdef from pg_indexes where schemaname='public'
and tablename in ('board_posts','board_comments','board_reports','board_moderation_logs','board_aliases','board_view_days');
select table_name,grantee,privilege_type from information_schema.table_privileges
where table_schema='public' and starts_with(table_name,'board_') order by table_name,grantee;
select table_name,column_name,grantee,privilege_type from information_schema.column_privileges
where table_schema='public' and starts_with(table_name,'board_') order by table_name,column_name,grantee;
-- If migration_history_present=true, DB owner must separately inspect migration
-- versions/names (not statements or application data) against the deployment log.
rollback;
