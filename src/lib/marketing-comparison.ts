import {trafficSources,readAttribution}from './attribution.ts';
export type MarketingApplication={id:string;event_id:string;source:string;utm_source:string|null;created_at?:string};
export type MarketingParticipation={event_id:string;source:string;application_id:string;confirmation:string;attendance:string};
export type MarketingEvent={id:string;title:string;slug:string;starts_at:string|null;created_at:string};
export type MonthlyAttendance={event_id:string;source:string;application_id:string;person_id:string;session_date:string};
export function summarizeAcquisition(applications:MarketingApplication[],participation:MarketingParticipation[]){
 const key=(event:string,source:string,id:string)=>`${event}:${source}:${id}`;
 const links=new Map(participation.map(row=>[key(row.event_id,row.source,row.application_id),row]));
 const channels=new Map<string,{source:string;label:string;applications:number;confirmed:number;attended:number;unlinked:number}>();
 const eventCounts=new Map<string,number>();
 const seen=new Set<string>();
 for(const application of applications){
  const identity=key(application.event_id,application.source,application.id);if(seen.has(identity))continue;seen.add(identity);
  eventCounts.set(application.event_id,(eventCounts.get(application.event_id)??0)+1);
  const normalized=readAttribution(new URLSearchParams({utm_source:application.utm_source??''})).utm_source;
  const source=!normalized?'unknown':Object.hasOwn(trafficSources,normalized)?normalized:'other';
  const label=source==='unknown'?'유입 미확인':source==='other'?'기타':trafficSources[source as keyof typeof trafficSources];
  const channel=channels.get(source)??{source,label,applications:0,confirmed:0,attended:0,unlinked:0};
  const linked=links.get(identity);channel.applications++;
  if(linked?.confirmation==='confirmed')channel.confirmed++;
  if(linked?.attendance==='attended')channel.attended++;
  if(!linked)channel.unlinked++;
  channels.set(source,channel);
 }
 return {eventCounts,channels:[...channels.values()].sort((a,b)=>b.applications-a.applications||a.source.localeCompare(b.source))};
}

export function monthlyAcquisition(applications:MarketingApplication[],attendance:MonthlyAttendance[],now=Date.now()){
 const today=new Date(now+9*3600000).toISOString().slice(0,10),month=today.slice(0,7);
 const valid=new Set(applications.map(row=>`${row.event_id}:${row.source}:${row.id}`));
 const applicants=new Map<string,Set<string>>(),people=new Map<string,Set<string>>();
 for(const row of applications){const time=Date.parse(row.created_at??'');if(!Number.isFinite(time)||time>now)continue;const key=new Date(time+9*3600000).toISOString().slice(0,7);const values=applicants.get(key)??new Set<string>();values.add(`${row.event_id}:${row.source}:${row.id}`);applicants.set(key,values);}
 for(const row of attendance){if(!valid.has(`${row.event_id}:${row.source}:${row.application_id}`)||row.session_date>today)continue;const key=row.session_date.slice(0,7);if(!/^\d{4}-\d{2}$/.test(key))continue;const values=people.get(key)??new Set<string>();values.add(row.person_id);people.set(key,values);}
 const offsetMonth=(offset:number)=>new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5))-1+offset,1)).toISOString().slice(0,7);
 const read=(key:string)=>({applications:applicants.get(key)?.size??0,participants:people.get(key)?.size??0,applicationRecorded:applicants.has(key),participantRecorded:people.has(key),recorded:applicants.has(key)||people.has(key)});
 return Array.from({length:12},(_,index)=>{const key=offsetMonth(index-11);return {month:key,current:key===month,...read(key),previous:read(offsetMonth(index-23))};});
}
