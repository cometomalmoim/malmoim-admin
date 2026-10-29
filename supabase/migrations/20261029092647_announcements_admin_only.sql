begin;
-- Retain all posts, comments, reports and audit records. Restrict new writes.
alter policy member_board_insert on public.board_posts with check (author_id=auth.uid() and status='public' and not is_pinned and public.member_board_admin());
alter policy member_board_update on public.board_posts using (public.member_board_admin()) with check (public.member_board_admin());
alter policy member_comment_insert on public.board_comments with check (author_id=auth.uid() and status='public' and public.member_board_admin());
alter policy member_comment_update on public.board_comments using (public.member_board_admin()) with check (public.member_board_admin());
-- The existing definer RPC is also a write path, so guard it before any mutation.
do $migration$
declare definition text; marker text := ' if uid is null then raise exception ''Login required'' using errcode=''42501'';end if;';
begin
 select pg_get_functiondef('public.member_board_mutate(text,uuid,timestamp with time zone,jsonb,uuid)'::regprocedure) into definition;
 if position(marker in definition)=0 then raise exception 'Unexpected board RPC definition';end if;
 definition:=replace(definition,marker,marker||E'\n if p_action in (''post_save'',''post_delete'',''comment_save'',''comment_delete'') and not adm then raise exception ''Team publishing only'' using errcode=''42501'';end if;');
 execute definition;
end $migration$;
commit;
