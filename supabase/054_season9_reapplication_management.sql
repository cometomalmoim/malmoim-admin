-- Manage repeated Season 9 phone submissions independently.
-- Keep duplicate rejection for new manual records and contact changes.
begin;
do $guard$ begin if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid='public.manage_event_application(text,text,uuid,integer,text,text,text,integer,text,text,text,text,text)'::regprocedure) not in ('6fba9bde944b261edb84c4a2b432f148','75875cbb5a649525a47c59abf7142cc6') then raise exception 'Unexpected applicant management definition';end if;end $guard$;
create or replace function public.manage_event_application(p_slug text,p_source text,p_id uuid,p_revision integer,p_name text,p_contact text,p_contact_type text,p_birth_year integer,p_nationality text,p_status text,p_payment text,p_note text,p_source_note text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.recruitment_events; previous public.event_application_list; normalized text; v_application_id uuid:=p_id; begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid()) then return jsonb_build_object('code','forbidden');end if;
 if p_source is null or p_source not in ('manual','registration','season9') then return jsonb_build_object('code','invalid');end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 100 or p_contact is null or length(btrim(p_contact)) not between 1 and 200
 or p_contact_type is null or p_contact_type not in ('phone','instagram') or p_status is null or p_status not in ('received','reviewing','accepted','waitlisted','declined','withdrawn')
 or p_payment is null or p_payment not in ('unknown','unpaid','paid','refunded') or p_note is null or length(p_note)>3000 or length(p_nationality)>100
 or (p_birth_year is not null and (p_birth_year<1900 or p_birth_year>extract(year from current_date))) then return jsonb_build_object('code','invalid');end if;
 normalized:=public.event_contact_key(p_contact,p_contact_type);
 if normalized is null or normalized='' then return jsonb_build_object('code','invalid');end if;
 select * into e from public.recruitment_events where slug=p_slug for update;
 if not found then return jsonb_build_object('code','missing');end if;
 if p_id is not null then
 select * into previous from public.event_application_list where event_id=e.id and id=p_id and source=p_source;
 if not found then return jsonb_build_object('code','missing');end if;
 if p_revision is distinct from previous.revision then return jsonb_build_object('code','conflict');end if;
 if p_source='registration' and p_contact_type<>'phone' then return jsonb_build_object('code','invalid');end if;
 else
 if p_source<>'manual' or p_source_note is null or length(btrim(p_source_note)) not between 1 and 1000 then return jsonb_build_object('code','invalid');end if;
 end if;
 if not (e.slug='season9' and p_source='season9' and p_id is not null and p_contact_type='phone' and previous.contact_type='phone' and public.event_contact_key(previous.contact,'phone')=normalized) and exists(select 1 from public.event_application_list a where a.event_id=e.id and a.contact_type=p_contact_type and public.event_contact_key(a.contact,a.contact_type)=normalized and (p_id is null or a.id<>p_id or a.source<>p_source)) then return jsonb_build_object('code','duplicate');end if;
 if p_id is null then
 insert into public.event_manual_applications(event_id,name,contact,contact_type,source_note) values(e.id,btrim(p_name),normalized,p_contact_type,btrim(p_source_note)) returning id into v_application_id;
 elsif p_source='manual' then
 if p_source_note is null or length(btrim(p_source_note)) not between 1 and 1000 then return jsonb_build_object('code','invalid');end if;
 update public.event_manual_applications set name=btrim(p_name),contact=normalized,contact_type=p_contact_type,source_note=btrim(p_source_note) where id=p_id and event_id=e.id;
 elsif p_source='registration' then
 update public.event_registration_responses set name=btrim(p_name),contact=normalized where id=p_id and event_id=e.id;
 elsif p_source='season9' then
 update public.event_applications set name=btrim(p_name),contact=normalized,contact_type=p_contact_type where id=p_id and event_id=e.id;
 else return jsonb_build_object('code','invalid');end if;
 insert into public.event_application_management(source,application_id,event_id,birth_year,nationality,internal_note,status,payment_status,revision,updated_by)
 values(p_source,v_application_id,e.id,p_birth_year,nullif(btrim(p_nationality),''),p_note,p_status,p_payment,coalesce(previous.revision,0)+1,auth.uid())
 on conflict(source,application_id) do update set birth_year=excluded.birth_year,nationality=excluded.nationality,internal_note=excluded.internal_note,status=excluded.status,payment_status=excluded.payment_status,revision=excluded.revision,updated_at=clock_timestamp(),updated_by=excluded.updated_by;
 insert into public.event_application_audit(event_id,source,application_id,actor,action,old_status,new_status,old_payment,new_payment)
 values(e.id,p_source,v_application_id,auth.uid(),case when p_id is null then 'manual_create' else 'update' end,previous.status,p_status,previous.payment_status,p_payment);
 return jsonb_build_object('code','saved','id',v_application_id,'revision',coalesce(previous.revision,0)+1);
end $$;
notify pgrst,'reload schema';
commit;
