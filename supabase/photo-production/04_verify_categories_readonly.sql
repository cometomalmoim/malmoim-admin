-- READ ONLY. Dashboard must be on the intended project. No user content returned.
BEGIN READ ONLY;
SELECT a.attname,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS default_value
FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
WHERE a.attrelid=to_regclass('public.history_photo_albums') AND a.attname IN ('category','cohort') AND NOT a.attisdropped;
SELECT conname,pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid=to_regclass('public.history_photo_albums') AND conname IN ('hs_album_category_allowed','hs_album_cohort_valid');
COMMIT;
