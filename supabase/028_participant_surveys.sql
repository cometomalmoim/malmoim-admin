-- Cohort-level anonymous participant surveys. Apply only after reviewing in Supabase SQL Editor.
-- Does not alter existing event, suggestion, participant, or administrator tables.
begin;

create table public.participant_surveys (
  id uuid primary key default gen_random_uuid(),
  cohort_name text not null unique check (char_length(btrim(cohort_name)) between 1 and 80),
  public_token text not null unique check (public_token ~ '^[0-9a-f]{64}$'),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  questionnaire_version text not null default 'v1' check (questionnaire_version = 'v1'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes_at > opens_at)
);

create table public.participant_survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.participant_surveys(id) on delete restrict,
  respondent_group text not null check (respondent_group in ('korean', 'international')),
  satisfaction smallint not null check (satisfaction between 1 and 5),
  liked_aspects text[] not null check (
    cardinality(liked_aspects) between 1 and 7
    and liked_aspects <@ array['language_growth','varied_activities','comfortable_environment','diverse_people','atmosphere_and_organization','mutual_learning','none']::text[]
    and not ('none' = any(liked_aspects) and cardinality(liked_aspects) > 1)
  ),
  study_feedback text not null default '' check (char_length(study_feedback) <= 3000),
  activity_feedback text not null default '' check (char_length(activity_feedback) <= 3000),
  other_feedback text not null default '' check (char_length(other_feedback) <= 3000),
  submitted_at timestamptz not null default now()
);

create index participant_surveys_status_period_idx on public.participant_surveys(status, opens_at, closes_at);
create index participant_survey_responses_survey_group_idx on public.participant_survey_responses(survey_id, respondent_group, submitted_at desc);

create function public.participant_surveys_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;

create trigger participant_surveys_touch_updated_at
before update on public.participant_surveys
for each row execute function public.participant_surveys_touch_updated_at();
revoke all on function public.participant_surveys_touch_updated_at() from public, anon, authenticated;

alter table public.participant_surveys enable row level security;
alter table public.participant_surveys force row level security;
alter table public.participant_survey_responses enable row level security;
alter table public.participant_survey_responses force row level security;

revoke all on public.participant_surveys, public.participant_survey_responses from public, anon, authenticated;
grant select on public.participant_surveys, public.participant_survey_responses to authenticated;
grant insert (cohort_name, public_token, status, opens_at, closes_at, questionnaire_version) on public.participant_surveys to authenticated;
grant update (status, opens_at, closes_at) on public.participant_surveys to authenticated;

create policy participant_surveys_admin_select on public.participant_surveys
for select to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
create policy participant_surveys_admin_insert on public.participant_surveys
for insert to authenticated
with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
create policy participant_surveys_admin_update on public.participant_surveys
for update to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
create policy participant_survey_responses_admin_select on public.participant_survey_responses
for select to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

create function public.participant_survey_public_state(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare s public.participant_surveys;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return jsonb_build_object('exists', false, 'open', false); end if;
  select * into s from public.participant_surveys where public_token = p_token;
  if not found then return jsonb_build_object('exists', false, 'open', false); end if;
  return jsonb_build_object(
    'exists', true,
    'state', case
      when s.status = 'closed' or pg_catalog.clock_timestamp() >= s.closes_at then 'closed'
      when s.status <> 'open' or pg_catalog.clock_timestamp() < s.opens_at then 'not_open'
      else 'open'
    end
  );
end;
$$;

create function public.submit_participant_survey(
  p_token text,
  p_group text,
  p_satisfaction integer,
  p_liked_aspects text[],
  p_study_feedback text,
  p_activity_feedback text,
  p_other_feedback text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare s public.participant_surveys; allowed text[] := array['language_growth','varied_activities','comfortable_environment','diverse_people','atmosphere_and_organization','mutual_learning','none']::text[];
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return 'unavailable'; end if;
  select * into s from public.participant_surveys where public_token = p_token for update;
  if not found or s.status <> 'open' or pg_catalog.clock_timestamp() < s.opens_at or pg_catalog.clock_timestamp() >= s.closes_at then return 'closed'; end if;
  if p_group is null or p_group not in ('korean','international') or p_satisfaction is null or p_satisfaction not between 1 and 5
    or p_liked_aspects is null or pg_catalog.cardinality(p_liked_aspects) not between 1 and 7
    or not (p_liked_aspects <@ allowed)
    or ('none' = any(p_liked_aspects) and pg_catalog.cardinality(p_liked_aspects) > 1)
    or pg_catalog.cardinality(p_liked_aspects) <> pg_catalog.cardinality(array(select distinct value from pg_catalog.unnest(p_liked_aspects) as u(value)))
    or p_study_feedback is null or pg_catalog.char_length(p_study_feedback) > 3000
    or p_activity_feedback is null or pg_catalog.char_length(p_activity_feedback) > 3000
    or p_other_feedback is null or pg_catalog.char_length(p_other_feedback) > 3000 then return 'invalid'; end if;
  -- Anonymous abuse control: serialize per survey and limit volume without storing IPs or cookies.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(s.id::text));
  if (select pg_catalog.count(*) from public.participant_survey_responses r where r.survey_id = s.id and r.submitted_at > pg_catalog.clock_timestamp() - interval '1 minute') >= 60 then return 'busy'; end if;
  -- Recheck the deadline after taking the lock; an in-flight request cannot pass the close time.
  if pg_catalog.clock_timestamp() >= s.closes_at then return 'closed'; end if;
  insert into public.participant_survey_responses(survey_id, respondent_group, satisfaction, liked_aspects, study_feedback, activity_feedback, other_feedback)
  values(s.id, p_group, p_satisfaction::smallint, p_liked_aspects, pg_catalog.btrim(p_study_feedback), pg_catalog.btrim(p_activity_feedback), pg_catalog.btrim(p_other_feedback));
  return 'saved';
end;
$$;

create function public.admin_participant_survey_stats(p_survey_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare option_keys text[] := array['language_growth','varied_activities','comfortable_environment','diverse_people','atmosphere_and_organization','mutual_learning','none']::text[];
begin
  if not exists (select 1 from public.admin_users where user_id = (select auth.uid())) then raise exception 'Forbidden'; end if;
  if not exists (select 1 from public.participant_surveys where id = p_survey_id) then return null; end if;
  return jsonb_build_object(
    'total', (select pg_catalog.count(*) from public.participant_survey_responses where survey_id = p_survey_id),
    'average', (select pg_catalog.round(pg_catalog.avg(satisfaction)::numeric, 2) from public.participant_survey_responses where survey_id = p_survey_id),
    'korean', (select jsonb_build_object(
      'count', (select pg_catalog.count(*) from public.participant_survey_responses where survey_id = p_survey_id and respondent_group = 'korean'),
      'average', (select pg_catalog.round(pg_catalog.avg(satisfaction)::numeric, 2) from public.participant_survey_responses where survey_id = p_survey_id and respondent_group = 'korean'),
      'aspects', (select coalesce(pg_catalog.jsonb_object_agg(a.option_key, a.picked_count), '{}'::jsonb) from (select k.option_key, (select pg_catalog.count(*) from public.participant_survey_responses r where r.survey_id = p_survey_id and r.respondent_group = 'korean' and k.option_key = any(r.liked_aspects)) as picked_count from pg_catalog.unnest(option_keys) as k(option_key)) a)
    )),
    'international', (select jsonb_build_object(
      'count', (select pg_catalog.count(*) from public.participant_survey_responses where survey_id = p_survey_id and respondent_group = 'international'),
      'average', (select pg_catalog.round(pg_catalog.avg(satisfaction)::numeric, 2) from public.participant_survey_responses where survey_id = p_survey_id and respondent_group = 'international'),
      'aspects', (select coalesce(pg_catalog.jsonb_object_agg(a.option_key, a.picked_count), '{}'::jsonb) from (select k.option_key, (select pg_catalog.count(*) from public.participant_survey_responses r where r.survey_id = p_survey_id and r.respondent_group = 'international' and k.option_key = any(r.liked_aspects)) as picked_count from pg_catalog.unnest(option_keys) as k(option_key)) a)
    ))
  );
end;
$$;

revoke all on function public.participant_survey_public_state(text) from public;
revoke all on function public.submit_participant_survey(text,text,integer,text[],text,text,text) from public;
revoke all on function public.admin_participant_survey_stats(uuid) from public, anon, authenticated;
grant execute on function public.participant_survey_public_state(text), public.submit_participant_survey(text,text,integer,text[],text,text,text) to anon, authenticated;
grant execute on function public.admin_participant_survey_stats(uuid) to authenticated;

commit;
