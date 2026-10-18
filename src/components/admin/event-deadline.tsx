import {recruitmentDeadline} from '@/lib/event-lifecycle';
export function EventDeadline({closesAt}:{closesAt:string|null}){
 const result=recruitmentDeadline(closesAt);
 const title=closesAt&&Number.isFinite(Date.parse(closesAt))?`모집 마감: ${new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium',timeStyle:'short'}).format(new Date(closesAt))} (한국시간)`:'모집 마감일 미정';
 return <span className={`event-deadline ${result.urgent?'event-deadline-urgent':''}`} title={title} aria-label={`${result.label} · ${title}`}>{result.label}</span>;
}
