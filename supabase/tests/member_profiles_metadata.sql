-- Revised draft: korean_proficiency + english_proficiency fixed five-level fields;
-- member_languages is additional languages only (0..3, excluding ko/en).
-- READ-ONLY METADATA REVIEW. No member rows, tokens, contact data or Auth data.
-- Run only when a DB owner authorizes the metadata review; this file applies nothing.
select table_schema,table_name,column_name,data_type,is_nullable
from information_schema.columns
where table_schema='public' and table_name in ('member_profiles','member_languages')
order by table_name,ordinal_position;
select c.relname,c.relrowsecurity,c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('member_profiles','member_languages');
select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies where schemaname='public' and tablename in ('member_profiles','member_languages');
select grantee,table_name,privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name in ('member_profiles','member_languages')
order by table_name,grantee,privilege_type;
select p.proname,pg_get_function_identity_arguments(p.oid) arguments,p.prosecdef,p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
('save_member_profile','member_registration_ready','member_language_count_check','member_profile_protect');
select c.relname,con.conname,pg_get_constraintdef(con.oid) definition
from pg_constraint con join pg_class c on c.oid=con.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('member_profiles','member_languages');
