-- Additive inquiry inbox. No application/payment/SMS settings are changed.
begin;
create table public.event_inquiries (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.recruitment_events(id) on delete restrict,
 receipt_token text not null unique check(receipt_token ~ '^[a-f0-9]{64}$'),
 name text not null check(char_length(name) between 1 and 60),
 subject text not null check(char_length(subject) between 1 and 120),
 content text not null check(char_length(content) between 1 and 3000),
 locale text not null check(locale in ('ko','en')),
 status text not null default 'received' check(status in ('received','answered')),
 revision integer not null default 0,
 created_at timestamptz not null default now(),
 consent_version text not null default 'inquiry-2026-10-19-v1'
);
create index on public.event_inquiries(event_id,created_at desc,id);
create table public.event_inquiry_replies (
 id uuid primary key default gen_random_uuid(),
 inquiry_id uuid not null references public.event_inquiries(id) on delete restrict,
 body text not null check(char_length(body) between 1 and 3000),
 author_id uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index on public.event_inquiry_replies(inquiry_id,created_at,id);
alter table public.event_inquiries enable row level security;
alter table public.event_inquiries force row level security;
alter table public.event_inquiry_replies enable row level security;
alter table public.event_inquiry_replies force row level security;
revoke all on public.event_inquiries,public.event_inquiry_replies from public,anon,authenticated;
grant select on public.event_inquiries,public.event_inquiry_replies to authenticated;
create policy "Admins read inquiries" on public.event_inquiries for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "Admins read inquiry replies" on public.event_inquiry_replies for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));

create function public.inquiry_event_info(p_slug text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('title',e.title,'slug',e.slug) from public.recruitment_events e where e.slug=p_slug and e.status in ('published','closed') and not e.is_archived and not e.is_test;
$$;
create function public.submit_event_inquiry(p_slug text,p_token text,p_name text,p_subject text,p_content text,p_locale text,p_consent boolean) returns text language plpgsql security definer set search_path='' as $$
declare ev public.recruitment_events; prior public.event_inquiries;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' or p_name is null or char_length(btrim(p_name)) not between 1 and 60 or p_subject is null or char_length(btrim(p_subject)) not between 1 and 120 or p_content is null or char_length(btrim(p_content)) not between 1 and 3000 or p_locale is null or p_locale not in ('ko','en') or p_consent is distinct from true then return 'invalid'; end if;
 -- Serialize per event, including the archive check and the intake cap.
 select * into ev from public.recruitment_events where slug=p_slug for update;
 if not found or ev.is_archived or ev.is_test or ev.status not in ('published','closed') then return 'closed'; end if;
 select * into prior from public.event_inquiries where receipt_token=p_token;
 if found then
  if prior.event_id=ev.id and prior.name=btrim(p_name) and prior.subject=btrim(p_subject) and prior.content=btrim(p_content) and prior.locale=p_locale then return 'saved'; end if;
  return 'invalid';
 end if;
 if (select count(*) from public.event_inquiries where event_id=ev.id and created_at>now()-interval '1 hour')>=60 then return 'rate_limited'; end if;
 insert into public.event_inquiries(event_id,receipt_token,name,subject,content,locale) values(ev.id,p_token,btrim(p_name),btrim(p_subject),btrim(p_content),p_locale);
 return 'saved';
end $$;
create function public.read_event_inquiry(p_token text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return null; end if;
 select jsonb_build_object('event_title',e.title,'name',i.name,'subject',i.subject,'content',i.content,'locale',i.locale,'status',i.status,'created_at',i.created_at,'replies',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'body',r.body,'created_at',r.created_at) order by r.created_at,r.id) from public.event_inquiry_replies r where r.inquiry_id=i.id),'[]'::jsonb)) into result
 from public.event_inquiries i join public.recruitment_events e on e.id=i.event_id where i.receipt_token=p_token;
 return result;
end $$;
create function public.reply_event_inquiry(p_id uuid,p_revision integer,p_body text) returns text language plpgsql security definer set search_path='' as $$
declare item public.event_inquiries;
begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid()) then return 'forbidden'; end if;
 if p_body is null or char_length(btrim(p_body)) not between 1 and 3000 then return 'invalid'; end if;
 select * into item from public.event_inquiries where id=p_id for update;
 if not found then return 'missing'; end if;
 if p_revision is null or item.revision<>p_revision then return 'stale'; end if;
 insert into public.event_inquiry_replies(inquiry_id,body,author_id) values(item.id,btrim(p_body),auth.uid());
 update public.event_inquiries set status='answered',revision=revision+1 where id=item.id;
 return 'saved';
end $$;
revoke all on function public.inquiry_event_info(text),public.submit_event_inquiry(text,text,text,text,text,text,boolean),public.read_event_inquiry(text),public.reply_event_inquiry(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.inquiry_event_info(text),public.submit_event_inquiry(text,text,text,text,text,text,boolean),public.read_event_inquiry(text) to anon,authenticated;
grant execute on function public.reply_event_inquiry(uuid,integer,text) to authenticated;
commit;
