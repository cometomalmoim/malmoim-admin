-- Approved operating details: six weekly Thursday and Saturday sessions,
-- KRW 12,000 per session, no participation capacity limit.
begin;
insert into public.community_daily_sessions(title,starts_at,ends_at,closes_at,location,fee,is_open)
select '말모임 9기 '||x.day_name||' · '||(n+1)||'회차',
 x.first_start+n*interval '7 days',x.first_start+n*interval '7 days'+interval '150 minutes',
 x.first_start+n*interval '7 days','서울청년센터 은평 · 서울 은평구 통일로67길 9',12000,true
from (values ('목요일',timestamptz '2026-11-05 18:30:00+09'),('토요일',timestamptz '2026-11-07 13:00:00+09')) x(day_name,first_start)
cross join generate_series(0,5) n
where not exists(select 1 from public.community_daily_sessions s where s.starts_at=x.first_start+n*interval '7 days');
commit;
