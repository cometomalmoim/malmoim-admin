-- Apply after 021. Preserve existing system posts while adding ideas.
begin;
alter table public.internal_board_posts drop constraint internal_board_posts_category_check;
alter table public.internal_board_posts add constraint internal_board_posts_category_check check(category in ('공지','자유','아이디어','행사','시스템'));
commit;
