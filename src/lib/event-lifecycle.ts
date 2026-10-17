export function eventHasEnded(event:{ends_at:string|null},now=Date.now()){
 const end=event.ends_at?Date.parse(event.ends_at):NaN;return Number.isFinite(end)&&end<=now;
}
export function recruitmentDeadline(value:string|null,now=Date.now()){
 const end=value?Date.parse(value):NaN;
 if(!Number.isFinite(end))return {label:'마감 미정',urgent:false};
 if(end<=now)return {label:'마감 지남',urgent:false};
 const day=(time:number)=>{const d=new Date(time+9*3600000);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());};
 const remaining=Math.round((day(end)-day(now))/86400000);
 return {label:remaining===0?'D-DAY':`D-${remaining}`,urgent:remaining<=3};
}

export function withinUpcomingWindow(value:string|null,now=Date.now()){
 const start=value?Date.parse(value):NaN;return Number.isFinite(start)&&start>=now&&start<=now+30*86400000;
}

export function groupEventDirectory<T extends {ends_at:string|null;is_archived:boolean}>(events:T[],now=Date.now()){
 return {
  active:events.filter(event=>!event.is_archived&&!eventHasEnded(event,now)),
  ended:events.filter(event=>!event.is_archived&&eventHasEnded(event,now)).sort((a,b)=>Date.parse(b.ends_at!)-Date.parse(a.ends_at!)),
  archived:events.filter(event=>event.is_archived),
 };
}
