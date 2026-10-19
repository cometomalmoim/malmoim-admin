-- Same underlying administrator RLS; no new public or write access.
begin;
create view public.event_application_language_list with(security_invoker=true) as
select a.*,s.korean_level,s.english_level,
case when regexp_replace(lower(coalesce(a.nationality,'')),'[^a-z가-힣]','','g') in ('','미입력','미확인','미상','국적미상','unknown','none') then 'unknown'
 when regexp_replace(lower(a.nationality),'[^a-z가-힣]','','g') in ('대한민국','한국','한국인','대한민국한국','한국대한민국','korea','southkorea','republicofkorea','korearepublicof','korean','southkorean','kr','kor','대한민국southkorea','한국southkorea') then 'korean'
 else 'foreign' end as nationality_group
from public.event_application_admin_list a
left join public.event_applications s on a.source='season9' and a.event_id=s.event_id and a.id=s.id;
revoke all on public.event_application_language_list from public,anon;
grant select on public.event_application_language_list to authenticated;
commit;
