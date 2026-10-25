-- READ ONLY. Returns schema metadata only, never member records.
begin read only;
select jsonb_build_object(
 'bypass_owner',exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)),
 'objects',(select jsonb_object_agg(name,to_regclass('public.'||name) is not null) from unnest(array['member_profiles','member_languages','board_aliases','member_registration_policies','member_policy_acceptances','member_signup_requests']) name),
 'columns',(select coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull) order by c.relname,a.attnum),'[]') from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('member_profiles','member_languages','board_aliases','member_registration_policies','member_policy_acceptances') and a.attnum>0 and not a.attisdropped),
 'functions',(select coalesce(jsonb_agg(jsonb_build_object('name',p.proname,'signature',pg_get_function_identity_arguments(p.oid),'definer',p.prosecdef,'source',p.prosrc,'settings',p.proconfig) order by p.proname),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'member_registration%' or p.proname like 'save_member_%' or p.proname like 'member_nickname_%' or p.proname in ('member_board_protect','prepare_member_registration','member_signup_auth_profile'))),
 'auth_insert_triggers',(select coalesce(jsonb_agg(jsonb_build_object('name',t.tgname,'definition',pg_get_triggerdef(t.oid))),'[]') from pg_trigger t where t.tgrelid=to_regclass('auth.users') and not t.tgisinternal)
) as signup_metadata;
rollback;
