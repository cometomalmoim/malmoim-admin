-- PREPARED ONLY. Confirm Production project qkhlvdctdcpfyvohhikl in Dashboard.
-- Never rerun the original photo installer. No Storage/Auth/event/RLS changes.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'STOP: expected postgres installer'; END IF;
 IF to_regclass('public.history_photo_albums') IS NULL OR to_regclass('public.history_photo_items') IS NULL THEN RAISE EXCEPTION 'STOP: photo installation missing'; END IF;
 IF NOT EXISTS(SELECT FROM pg_class WHERE oid='public.history_photo_albums'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'STOP: album RLS missing'; END IF;
 IF EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.history_photo_albums'::regclass AND attname IN ('category','cohort') AND NOT attisdropped) THEN RAISE EXCEPTION 'STOP: category column collision; inspect instead of overwrite'; END IF;
 IF NOT EXISTS(SELECT FROM storage.buckets WHERE id='history-simple-photos' AND NOT public) THEN RAISE EXCEPTION 'STOP: expected private photo bucket missing'; END IF;
END $$;
ALTER TABLE public.history_photo_albums
 ADD COLUMN category text NOT NULL DEFAULT 'special',
 ADD COLUMN cohort smallint,
 ADD CONSTRAINT hs_album_category_allowed CHECK(category IN ('regular','special','event','study','other')),
 ADD CONSTRAINT hs_album_cohort_valid CHECK((category='regular' AND cohort IS NOT NULL AND cohort>0) OR (category<>'regular' AND cohort IS NULL));
-- Existing albums read as special / NULL. Existing rows/images/policies preserved.
COMMIT;
