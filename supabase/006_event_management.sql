-- Review and run ONCE after 003. Does not publish events or open intake.
begin;
alter table public.recruitment_events
 add column description text not null default '' check (char_length(description)<=5000),
 add column image_url text not null default '' check (char_length(image_url)<=2000 and (image_url='' or image_url ~ '^https://')),
 add column starts_at timestamptz,
 add column ends_at timestamptz,
 add column location text not null default '' check (char_length(location)<=300),
 add column capacity integer check (capacity between 1 and 100000),
 add column fee_notice text not null default '' check (char_length(fee_notice)<=1000),
 add column opens_at timestamptz,
 add constraint event_title_length check (char_length(title) between 1 and 150),
 add constraint event_schedule_order check (ends_at > starts_at),
 add constraint event_recruitment_order check (opens_at < closes_at),
 add constraint event_recruitment_before_start check (closes_at <= starts_at);
-- Column grants intentionally exclude publication/intake state, IDs and slug updates.
grant insert (slug,title,description,image_url,starts_at,ends_at,location,capacity,fee_notice,opens_at,closes_at) on public.recruitment_events to authenticated;
grant update (title,description,image_url,starts_at,ends_at,location,capacity,fee_notice,opens_at,closes_at) on public.recruitment_events to authenticated;
create policy "Registered administrators create events" on public.recruitment_events for insert to authenticated
 with check (exists (select 1 from public.admin_users where user_id=(select auth.uid())) and status='draft' and not applications_open);
create policy "Registered administrators edit events" on public.recruitment_events for update to authenticated
 using (exists (select 1 from public.admin_users where user_id=(select auth.uid())))
 with check (exists (select 1 from public.admin_users where user_id=(select auth.uid())));
commit;
