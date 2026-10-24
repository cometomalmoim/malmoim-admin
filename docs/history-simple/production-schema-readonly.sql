-- Optional inventory ONLY, for an explicitly selected project/SQL Editor.
-- Does not install or change anything. No users, credentials or object paths.
BEGIN READ ONLY;
SELECT
 to_regclass('public.admin_users') IS NOT NULL AS admin_users_exists,
 to_regclass('public.history_photo_albums') IS NOT NULL AS albums_exists,
 to_regclass('public.history_photo_items') IS NOT NULL AS items_exists,
 (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('history_photo_albums','history_photo_items') AND c.relrowsecurity) AS photo_tables_with_rls,
 (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND ((tablename='history_photo_albums' AND policyname IN ('hs_albums_admin','hs_albums_public')) OR (tablename='history_photo_items' AND policyname IN ('hs_items_admin','hs_items_public')))) AS photo_table_policies,
 (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname IN ('hs_storage_admin_select','hs_storage_admin_insert','hs_storage_admin_delete','hs_storage_public_read')) AS simple_storage_policies,
 (SELECT jsonb_build_object('private',NOT public,'size_limit',file_size_limit,'mime_types',allowed_mime_types) FROM storage.buckets WHERE id='history-simple-photos') AS simple_bucket,
 to_regprocedure('storage.allow_any_operation(text[])') IS NOT NULL AS operation_helper_exists;
COMMIT;
