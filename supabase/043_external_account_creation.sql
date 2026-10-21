-- Apply after 022_external_accounts.sql, including on existing installations.
-- Only CREATE is expanded. UPDATE, DELETE and secret access remain master-only.
begin;
alter table public.external_accounts add column created_by uuid;
-- Recover actual creators from retained audit evidence; do not invent owners for legacy rows.
update public.external_accounts e set created_by=(
 select l.actor_id from public.account_access_logs l where l.account_id=e.id and l.action='create' order by l.created_at,l.id limit 1
);
alter table public.external_accounts alter column created_by set default auth.uid();
create index external_accounts_creator on public.external_accounts(created_by);
-- No FK: creator attribution survives deletion of the login account.
create or replace function public.external_account_allowed(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.external_accounts e join public.admin_users a on a.user_id=auth.uid()
 left join public.external_account_members m on m.user_id=a.user_id
 where e.id=p_id and (e.created_by=auth.uid() or m.role='master' or m.user_id in(e.primary_manager,e.sub_manager) or (m.department<>'' and m.department=e.department)))
$$;
create or replace function public.manage_external_account(p_id uuid,p_version timestamptz,p_input jsonb,p_ciphertext text,p_delete boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare old_row public.external_accounts; new_row public.external_accounts; result_id uuid:=coalesce(p_id,gen_random_uuid()); delta jsonb:='{}';
begin
 if p_delete is null then raise exception 'Invalid operation'; end if;
 if p_id is null and not p_delete then
  if not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Forbidden'; end if;
 elsif not public.external_account_master() then raise exception 'Forbidden'; end if;
 if p_id is not null then
  select * into old_row from public.external_accounts where id=p_id for update;
  if not found or old_row.updated_at is distinct from p_version then raise exception 'Stale account'; end if;
 end if;
 if p_delete then
  if p_id is null then raise exception 'Missing account'; end if;
  delete from public.external_accounts where id=p_id;
 else
  if p_id is null and p_ciphertext is null then raise exception 'Password required'; end if;
  insert into public.external_accounts(id,created_by,service_name,service_url,login_id,category,department,primary_manager,sub_manager,billing_cycle,payment_method,amount,currency,next_billing_date,renewal_notice_days,notes)
  values(result_id,auth.uid(),p_input->>'service_name',p_input->>'service_url',p_input->>'login_id',p_input->>'category',coalesce(p_input->>'department',''),nullif(p_input->>'primary_manager','')::uuid,nullif(p_input->>'sub_manager','')::uuid,p_input->>'billing_cycle',p_input->>'payment_method',(p_input->>'amount')::numeric,p_input->>'currency',nullif(p_input->>'next_billing_date','')::date,(p_input->>'renewal_notice_days')::integer,p_input->>'notes')
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
revoke all on function public.manage_external_account(uuid,timestamptz,jsonb,text,boolean),public.external_account_allowed(uuid) from public,anon,authenticated;
grant execute on function public.manage_external_account(uuid,timestamptz,jsonb,text,boolean),public.external_account_allowed(uuid) to authenticated;
-- Existing table privileges remain read-only. All mutations use the checked RPC.
commit;
