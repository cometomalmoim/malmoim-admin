-- Apply after 018_schedule_management.sql. Independent from 022_board_idea_category.sql.
-- Explicitly provision roles with SQL; existing admins are NOT promoted automatically.
begin;
create table public.external_account_members (
 user_id uuid primary key references public.admin_users(user_id) on delete cascade,
 role text not null check(role in ('master','staff')),
 department text not null default '' check(length(department)<=100)
);
create table public.external_accounts (
 id uuid primary key default gen_random_uuid(),
 service_name text not null check(length(btrim(service_name)) between 1 and 120),
 service_url text not null check(service_url ~ '^https://[^[:space:]]+$' and length(service_url)<=2000),
 login_id text not null check(length(login_id) between 1 and 254),
 category text not null check(category in ('marketing','design','infrastructure','finance','other')),
 department text not null default '' check(length(department)<=100),
 primary_manager uuid references public.external_account_members(user_id),
 sub_manager uuid references public.external_account_members(user_id),
 billing_cycle text not null default 'monthly' check(billing_cycle in ('monthly','yearly','none')),
 payment_method text not null default '' check(length(payment_method)<=120),
 amount numeric(14,2) not null default 0 check(amount>=0),
 currency text not null default 'KRW' check(currency in ('KRW','USD','EUR','JPY')),
 next_billing_date date,
 renewal_notice_days integer not null default 7 check(renewal_notice_days between 0 and 90),
 notes text not null default '' check(length(notes)<=5000),
 updated_at timestamptz not null default clock_timestamp(),
 created_at timestamptz not null default now()
);
-- Ciphertext is never exposed by table SELECT, even to master admins.
create table public.external_account_secrets (
 account_id uuid primary key references public.external_accounts(id) on delete cascade,
 ciphertext text not null check(length(ciphertext) between 30 and 20000)
);
create table public.account_access_logs (
 id bigint generated always as identity primary key,
 account_id uuid not null,
 actor_id uuid not null,
 actor_name text not null,
 action text not null check(action in ('view','copy','create','update','delete')),
 changes jsonb not null default '{}',
 created_at timestamptz not null default clock_timestamp()
);
-- No FK to accounts/users: retain audit evidence after deletion.
create index account_access_logs_account_time on public.account_access_logs(account_id,created_at desc);
create index external_accounts_renewals on public.external_accounts(next_billing_date);
create table public.external_account_mfa_uses (
 user_id uuid not null, verified_at bigint not null, primary key(user_id,verified_at)
);
create function public.external_account_master() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.external_account_members m join public.admin_users a using(user_id) where m.user_id=auth.uid() and m.role='master')
$$;
create function public.external_account_allowed(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.external_accounts e join public.external_account_members m on m.user_id=auth.uid() join public.admin_users a on a.user_id=m.user_id
 where e.id=p_id and (m.role='master' or m.user_id in(e.primary_manager,e.sub_manager) or (m.department<>'' and m.department=e.department)))
$$;
alter table public.external_account_members enable row level security;
alter table public.external_account_members force row level security;
alter table public.external_accounts enable row level security;
alter table public.external_accounts force row level security;
alter table public.external_account_secrets enable row level security;
alter table public.external_account_secrets force row level security;
alter table public.account_access_logs enable row level security;
alter table public.account_access_logs force row level security;
alter table public.external_account_mfa_uses enable row level security;
alter table public.external_account_mfa_uses force row level security;
revoke all on public.external_account_members,public.external_accounts,public.external_account_secrets,public.account_access_logs,public.external_account_mfa_uses from public,anon,authenticated;
grant select on public.external_account_members,public.external_accounts,public.account_access_logs to authenticated;
create policy external_members_read on public.external_account_members for select to authenticated using(user_id=auth.uid() or public.external_account_master() or exists(select 1 from public.external_accounts e where external_account_members.user_id in(e.primary_manager,e.sub_manager) and public.external_account_allowed(e.id)));
create policy external_accounts_read on public.external_accounts for select to authenticated using(public.external_account_allowed(id));
create policy external_logs_read on public.account_access_logs for select to authenticated using(public.external_account_master() or public.external_account_allowed(account_id));
create function public.manage_external_account(p_id uuid,p_version timestamptz,p_input jsonb,p_ciphertext text,p_delete boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare old_row public.external_accounts; new_row public.external_accounts; result_id uuid:=coalesce(p_id,gen_random_uuid()); delta jsonb:='{}';
begin
 if not public.external_account_master() then raise exception 'Forbidden'; end if;
 if p_id is not null then
  select * into old_row from public.external_accounts where id=p_id for update;
  if not found or old_row.updated_at is distinct from p_version then raise exception 'Stale account'; end if;
 end if;
 if p_delete then
  if p_id is null then raise exception 'Missing account'; end if;
  delete from public.external_accounts where id=p_id;
 else
  if p_id is null and p_ciphertext is null then raise exception 'Password required'; end if;
  insert into public.external_accounts(id,service_name,service_url,login_id,category,department,primary_manager,sub_manager,billing_cycle,payment_method,amount,currency,next_billing_date,renewal_notice_days,notes)
  values(result_id,p_input->>'service_name',p_input->>'service_url',p_input->>'login_id',p_input->>'category',coalesce(p_input->>'department',''),nullif(p_input->>'primary_manager','')::uuid,nullif(p_input->>'sub_manager','')::uuid,p_input->>'billing_cycle',p_input->>'payment_method',(p_input->>'amount')::numeric,p_input->>'currency',nullif(p_input->>'next_billing_date','')::date,(p_input->>'renewal_notice_days')::integer,p_input->>'notes')
  on conflict(id) do update set service_name=excluded.service_name,service_url=excluded.service_url,login_id=excluded.login_id,category=excluded.category,department=excluded.department,primary_manager=excluded.primary_manager,sub_manager=excluded.sub_manager,billing_cycle=excluded.billing_cycle,payment_method=excluded.payment_method,amount=excluded.amount,currency=excluded.currency,next_billing_date=excluded.next_billing_date,renewal_notice_days=excluded.renewal_notice_days,notes=excluded.notes,updated_at=clock_timestamp()
  returning * into new_row;
  select coalesce(jsonb_object_agg(n.key,jsonb_build_object('before',to_jsonb(old_row)->n.key,'after',n.value)),'{}') into delta from jsonb_each(to_jsonb(new_row)) n where n.key not in ('updated_at','created_at') and n.value is distinct from to_jsonb(old_row)->n.key;
  if p_ciphertext is not null then
   insert into public.external_account_secrets values(result_id,p_ciphertext) on conflict(account_id) do update set ciphertext=excluded.ciphertext;
   delta:=delta||'{"password":"changed"}'::jsonb;
  end if;
 end if;
 insert into public.account_access_logs(account_id,actor_id,actor_name,action,changes)
 values(result_id,auth.uid(),coalesce((select display_name from public.admin_profiles where user_id=auth.uid()),auth.uid()::text),case when p_delete then 'delete' when p_id is null then 'create' else 'update' end,delta);
 return result_id;
end $$;
create function public.reveal_external_account(p_id uuid,p_action text) returns text
language plpgsql security definer set search_path='' as $$
declare verified bigint; secret text;
begin
 if not public.external_account_master() or p_action not in ('view','copy') or p_action is null or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'Forbidden'; end if;
 select max((v->>'timestamp')::bigint) into verified from jsonb_array_elements(auth.jwt()->'amr') v where v->>'method'='totp';
 if verified is null or verified<extract(epoch from clock_timestamp())-60 or verified>extract(epoch from clock_timestamp())+5 then raise exception 'Fresh MFA required'; end if;
 -- Atomic single consumption; reusing an elevated session cannot reveal another secret.
 insert into public.external_account_mfa_uses values(auth.uid(),verified);
 select ciphertext into strict secret from public.external_account_secrets where account_id=p_id;
 insert into public.account_access_logs(account_id,actor_id,actor_name,action) values(p_id,auth.uid(),coalesce((select display_name from public.admin_profiles where user_id=auth.uid()),auth.uid()::text),p_action);
 return secret;
end $$;
revoke all on function public.external_account_master(),public.external_account_allowed(uuid),public.manage_external_account(uuid,timestamptz,jsonb,text,boolean),public.reveal_external_account(uuid,text) from public,anon,authenticated;
grant execute on function public.external_account_master(),public.external_account_allowed(uuid),public.manage_external_account(uuid,timestamptz,jsonb,text,boolean),public.reveal_external_account(uuid,text) to authenticated;
-- Schedule integration contract: permission-filtered renewal feed, no secret fields.
create view public.external_account_renewals with(security_invoker=true) as
 select id as external_account_id,service_name as title,next_billing_date as starts_on,primary_manager as assignee_id,renewal_notice_days,amount,currency from public.external_accounts where next_billing_date is not null and billing_cycle<>'none';
grant select on public.external_account_renewals to authenticated;
commit;
