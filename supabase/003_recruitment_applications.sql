-- Review and run ONCE in Supabase SQL Editor. Does not open applications.
-- Existing administrator table is required. No service_role key is needed in the app.
begin;
create table public.recruitment_events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  status text not null default 'draft' check (status in ('draft','published','closed')),
  applications_open boolean not null default false,
  closes_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table public.event_applications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.recruitment_events(id) on delete restrict,
  submission_id uuid not null,
  name text not null check (char_length(name) between 1 and 100),
  contact text not null check (char_length(contact) between 1 and 200),
  contact_type text not null check (contact_type in ('phone','instagram')),
  preferred_class text not null check (preferred_class in ('thursday','saturday')),
  status text not null default 'received' check (status in ('received','reviewing','accepted','declined','withdrawn')),
  nationality text,
  gender text,
  date_of_birth date,
  occupation text,
  korean_level text,
  english_level text,
  motivation text,
  introduction text,
  full_attendance boolean,
  referral_sources text[] not null default '{}',
  payment_method text,
  privacy_notice_version text not null,
  privacy_consent boolean not null check (privacy_consent),
  photo_consent boolean not null default false,
  future_updates_consent boolean not null default false,
  fee_policy_confirmed boolean not null check (fee_policy_confirmed),
  consented_at timestamptz not null default now(),
  utm_source text check (char_length(utm_source) <= 150),
  utm_medium text check (char_length(utm_medium) <= 150),
  utm_campaign text check (char_length(utm_campaign) <= 150),
  utm_term text check (char_length(utm_term) <= 150),
  utm_content text check (char_length(utm_content) <= 150),
  created_at timestamptz not null default now(),
  unique (event_id, submission_id)
);
create index event_applications_event_created_idx on public.event_applications(event_id, created_at desc, id desc);
alter table public.recruitment_events enable row level security;
alter table public.recruitment_events force row level security;
alter table public.event_applications enable row level security;
alter table public.event_applications force row level security;
revoke all on public.recruitment_events, public.event_applications from public, anon, authenticated;
grant select on public.recruitment_events, public.event_applications to authenticated;
create policy "Registered administrators read recruitment events"
on public.recruitment_events for select to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
create policy "Registered administrators read applications"
on public.event_applications for select to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
-- No public read or insert/update/delete policies. Intake is intentionally disabled.
insert into public.recruitment_events(slug,title,status,applications_open,closes_at)
values ('season9','말모임 9기','draft',false,'2026-10-31T15:00:00Z');
commit;
-- Submission endpoint, atomic deadline enforcement, duplicate contact checks,
-- abuse prevention and final consent validation must be implemented BEFORE intake opens.
