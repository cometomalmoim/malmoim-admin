-- READ-ONLY metadata review. Run manually in the intended project; no row data.
select current_setting('server_encoding') as encoding, current_user;
select c.relname,c.relrowsecurity,c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('member_profiles','member_languages','board_aliases','board_posts','board_comments','board_reports','board_moderation_logs','board_view_days','member_registration_policies','member_policy_acceptances') order by c.relname;
select table_name,column_name,data_type,is_nullable,column_default,generation_expression
from information_schema.columns where table_schema='public' and table_name in ('member_profiles','member_languages','board_aliases','member_registration_policies','member_policy_acceptances') order by table_name,ordinal_position;
select tablename,indexname,indexdef from pg_indexes where schemaname='public' and tablename in ('board_aliases','member_registration_policies','member_policy_acceptances') order by tablename,indexname;
select conrelid::regclass as source,conname,pg_get_constraintdef(oid) as definition
from pg_constraint where contype='f' and confrelid=to_regclass('auth.users') order by conrelid::regclass::text,conname;
select p.oid::regprocedure as signature,p.prosecdef,p.proconfig,p.proacl,pg_get_userbyid(p.proowner) as owner
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'member_registration_%' or p.proname in ('save_member_profile','save_member_registration_v2','member_nickname_available','member_board_protect')) order by p.proname;
select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename in ('member_profiles','member_languages','board_aliases','member_registration_policies','member_policy_acceptances') order by tablename,policyname;
-- Compare installed function definitions privately against reviewed drafts.
-- Do not paste auth.users, profile, acceptance, secret, or session row data into reports.
