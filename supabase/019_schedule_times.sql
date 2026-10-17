-- Run the entire file after 018. Existing date-only schedules remain valid.
begin;
alter table public.schedules
 add column start_time time without time zone,
 add column end_time time without time zone,
 add constraint schedule_start_time_valid check(start_time < time '24:00' and extract(second from start_time)=0),
 add constraint schedule_end_time_valid check(end_time < time '24:00' and extract(second from end_time)=0),
 add constraint schedule_time_order check(start_date<>end_date or start_time is null or end_time is null or end_time>=start_time);

create or replace function public.save_schedule(p_id uuid,p_version integer,p_input jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.schedules; result_id uuid; starts time; ends time;
begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Forbidden'; end if;
 perform pg_catalog.pg_advisory_xact_lock(1818001);
 if p_id is not null then
  select * into r from public.schedules where id=p_id for update;
  if not found or r.version<>p_version then raise exception 'Stale schedule'; end if;
 end if;
 -- Omitted keys from older clients preserve times; explicit null clears them.
 starts:=case when p_input ? 'start_time' then nullif(p_input->>'start_time','')::time else r.start_time end;
 ends:=case when p_input ? 'end_time' then nullif(p_input->>'end_time','')::time else r.end_time end;
 if p_id is null then
  insert into public.schedules(title,start_date,end_date,start_time,end_time,tag_id,assignee_id,notes,created_by,updated_by)
  values(btrim(p_input->>'title'),(p_input->>'start_date')::date,(p_input->>'end_date')::date,starts,ends,(p_input->>'tag_id')::uuid,nullif(p_input->>'assignee_id','')::uuid,coalesce(p_input->>'notes',''),auth.uid(),auth.uid()) returning id into result_id;
 else
  if r.source_kind<>'manual' and (r.title is distinct from p_input->>'title' or r.start_date is distinct from (p_input->>'start_date')::date or r.end_date is distinct from (p_input->>'end_date')::date or r.start_time is distinct from starts or r.end_time is distinct from ends) then raise exception 'Edit source event'; end if;
  update public.schedules set title=btrim(p_input->>'title'),start_date=(p_input->>'start_date')::date,end_date=(p_input->>'end_date')::date,start_time=starts,end_time=ends,tag_id=(p_input->>'tag_id')::uuid,assignee_id=nullif(p_input->>'assignee_id','')::uuid,notes=coalesce(p_input->>'notes',''),version=version+1,updated_by=auth.uid(),updated_at=now() where id=p_id;
  result_id:=p_id;
 end if;
 return result_id;
end $$;

create or replace function public.sync_event_schedule() returns trigger language plpgsql security definer set search_path='' as $$
declare tag uuid; kind text; start_stamp timestamptz; end_stamp timestamptz; start_local timestamp; end_local timestamp;
begin
 perform pg_catalog.pg_advisory_xact_lock(1818001);
 select id into tag from public.schedule_tags where system_key='event';
 foreach kind in array array['event','recruitment'] loop
  if kind='event' then start_stamp:=new.starts_at; end_stamp:=new.ends_at; else start_stamp:=new.opens_at; end_stamp:=new.closes_at; end if;
  if new.is_test or start_stamp is null or end_stamp is null then delete from public.schedules where event_id=new.id and source_kind=kind;
  else
   start_local:=start_stamp at time zone 'Asia/Seoul';
   end_local:=end_stamp at time zone 'Asia/Seoul';
   -- Calendar end dates are inclusive: midnight ends at the previous day's 23:59.
   if end_local::time=time '00:00' then end_local:=end_local-interval '1 minute'; end if;
   insert into public.schedules(title,start_date,end_date,start_time,end_time,tag_id,source_kind,event_id)
   values(left(case when kind='recruitment' then '[모집] ' else '' end||new.title,150),start_local::date,end_local::date,date_trunc('minute',start_local)::time,date_trunc('minute',end_local)::time,tag,kind,new.id)
   on conflict(event_id,source_kind) do update set title=excluded.title,start_date=excluded.start_date,end_date=excluded.end_date,start_time=excluded.start_time,end_time=excluded.end_time,version=public.schedules.version+1,updated_at=now();
  end if;
 end loop;
 return new;
end $$;

-- Populate linked schedules without modifying source events, tags, notes or hidden state.
with source_times as (
 select s.id,
  (case when s.source_kind='event' then e.starts_at else e.opens_at end at time zone 'Asia/Seoul') as starts,
  (case when s.source_kind='event' then e.ends_at else e.closes_at end at time zone 'Asia/Seoul') as ends
 from public.schedules s join public.recruitment_events e on e.id=s.event_id where s.source_kind<>'manual'
)
update public.schedules s set start_time=date_trunc('minute',t.starts)::time,
 end_time=date_trunc('minute',case when t.ends::time=time '00:00' then t.ends-interval '1 minute' else t.ends end)::time,
 version=s.version+1,updated_at=now()
from source_times t where s.id=t.id;
revoke all on function public.save_schedule(uuid,integer,jsonb),public.sync_event_schedule() from public,anon,authenticated;
grant execute on function public.save_schedule(uuid,integer,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
