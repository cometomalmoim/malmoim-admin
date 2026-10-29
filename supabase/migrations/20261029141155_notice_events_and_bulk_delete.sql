begin;
alter table public.board_posts add column event_id uuid references public.recruitment_events(id) on delete set null;
create index board_posts_notice_event on public.board_posts(event_id,created_at desc) where category='notice';
grant select(event_id) on public.board_posts to anon,authenticated;
create or replace view public.public_notice_list with(security_invoker=true) as
 select id,title,content,language,images,category,status,is_pinned,created_at,updated_at,view_count,event_id from public.board_posts where category='notice' and status='public';
create function notice_private.save_with_event(p_id uuid,p_version timestamptz,p_title text,p_content text,p_language text,p_images text[],p_nonce uuid,p_event uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;existing public.board_posts;
begin
 if auth.uid() is null or not public.member_board_admin() then raise exception 'Admin required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,20261017));
 if p_event is not null and not exists(select 1 from public.recruitment_events where id=p_event) then raise exception 'Invalid event' using errcode='23514';end if;
 if p_id is null then
  select * into existing from public.board_posts where author_id=auth.uid() and submission_id=p_nonce;
  if found and existing.event_id is distinct from p_event then raise exception 'Submission changed' using errcode='40001';end if;
 end if;
 result:=notice_private.save_notice(p_id,p_version,p_title,p_content,p_language,p_images,p_nonce);
 update public.board_posts set event_id=p_event where id=result and event_id is distinct from p_event;
 return result;
end $$;
revoke all on function notice_private.save_with_event(uuid,timestamptz,text,text,text,text[],uuid,uuid) from public,anon;
grant execute on function notice_private.save_with_event(uuid,timestamptz,text,text,text,text[],uuid,uuid) to authenticated;
create function public.save_notice_with_event(p_id uuid,p_version timestamptz,p_title text,p_content text,p_language text,p_images text[],p_nonce uuid,p_event uuid) returns uuid language sql security invoker set search_path='' as $$select notice_private.save_with_event(p_id,p_version,p_title,p_content,p_language,p_images,p_nonce,p_event)$$;
revoke all on function public.save_notice_with_event(uuid,timestamptz,text,text,text,text[],uuid,uuid) from public,anon;
grant execute on function public.save_notice_with_event(uuid,timestamptz,text,text,text,text[],uuid,uuid) to authenticated;
create function notice_private.batch_status(p_items jsonb,p_restore boolean) returns integer language plpgsql security definer set search_path='' as $$
declare selected record;n integer;
begin
 if auth.uid() is null or not public.member_board_admin() then raise exception 'Admin required' using errcode='42501';end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 20 or p_restore is null then raise exception 'Invalid selection';end if;
 n:=jsonb_array_length(p_items);
 if (select count(distinct x.id) from jsonb_to_recordset(p_items) as x(id uuid,version timestamptz))<>n then raise exception 'Duplicate selection';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,20261017));
 perform 1 from public.board_posts where id in(select x.id from jsonb_to_recordset(p_items) as x(id uuid,version timestamptz)) order by id for update;
 if (select count(*) from public.board_posts p join jsonb_to_recordset(p_items) as x(id uuid,version timestamptz) on p.id=x.id where p.category='notice' and p.updated_at=x.version and ((p_restore and p.status='deleted') or (not p_restore and p.status<>'deleted')))<>n then raise exception 'Selection changed' using errcode='40001';end if;
 for selected in select p.id,p.updated_at from public.board_posts p join jsonb_to_recordset(p_items) as x(id uuid,version timestamptz) on p.id=x.id order by p.id loop
  if p_restore then
   update public.board_posts set status='hidden',is_pinned=false where id=selected.id;
   insert into public.board_moderation_logs(actor_id,post_id,action,reason) values(auth.uid(),selected.id,'notice_save','삭제된 공지를 숨김 상태로 복원');
  else perform public.member_board_mutate('post_delete',selected.id,selected.updated_at,'{}'::jsonb,null);end if;
 end loop;
 return n;
end $$;
revoke all on function notice_private.batch_status(jsonb,boolean) from public,anon;
grant execute on function notice_private.batch_status(jsonb,boolean) to authenticated;
create function public.batch_notice_status(p_items jsonb,p_restore boolean default false) returns integer language sql security invoker set search_path='' as $$select notice_private.batch_status(p_items,p_restore)$$;
revoke all on function public.batch_notice_status(jsonb,boolean) from public,anon;
grant execute on function public.batch_notice_status(jsonb,boolean) to authenticated;
commit;
