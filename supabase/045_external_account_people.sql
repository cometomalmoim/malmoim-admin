-- Apply after 019_people_management.sql, 022, 043 and 044.
-- People are independent of auth users. Preserve legacy primary_manager assignments.
begin;
alter table public.external_accounts add column if not exists manager_person_id uuid references public.people(id) on delete set null;
create or replace function public.manage_external_account(p_id uuid,p_version timestamptz,p_input jsonb,p_ciphertext text,p_delete boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare old_row public.external_accounts; new_row public.external_accounts; result_id uuid:=coalesce(p_id,gen_random_uuid()); delta jsonb:='{}';
begin
 if p_delete is null then raise exception 'Invalid operation'; end if;
 if not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Forbidden'; end if;
 if p_delete and not public.external_account_master() then raise exception 'Forbidden'; end if;
 if p_id is not null then
  select * into old_row from public.external_accounts where id=p_id for update;
  if not found or old_row.updated_at is distinct from p_version then raise exception 'Stale account'; end if;
 end if;
 if p_delete then
  if p_id is null then raise exception 'Missing account'; end if;
  delete from public.external_accounts where id=p_id;
 else
  if p_id is null and p_ciphertext is null then raise exception 'Password required'; end if;
  insert into public.external_accounts(id,created_by,service_name,service_url,login_id,category,department,primary_manager,manager_person_id,sub_manager,billing_cycle,payment_method,amount,currency,next_billing_date,renewal_notice_days,notes)
  values(result_id,auth.uid(),p_input->>'service_name',p_input->>'service_url',p_input->>'login_id',p_input->>'category',coalesce(p_input->>'department',''),nullif(p_input->>'primary_manager','')::uuid,nullif(p_input->>'manager_person_id','')::uuid,nullif(p_input->>'sub_manager','')::uuid,p_input->>'billing_cycle',p_input->>'payment_method',(p_input->>'amount')::numeric,p_input->>'currency',nullif(p_input->>'next_billing_date','')::date,(p_input->>'renewal_notice_days')::integer,p_input->>'notes')
  on conflict(id) do update set service_name=excluded.service_name,service_url=excluded.service_url,login_id=excluded.login_id,category=excluded.category,department=excluded.department,primary_manager=excluded.primary_manager,manager_person_id=excluded.manager_person_id,sub_manager=excluded.sub_manager,billing_cycle=excluded.billing_cycle,payment_method=excluded.payment_method,amount=excluded.amount,currency=excluded.currency,next_billing_date=excluded.next_billing_date,renewal_notice_days=excluded.renewal_notice_days,notes=excluded.notes,updated_at=clock_timestamp()
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
notify pgrst, 'reload schema';
commit;

