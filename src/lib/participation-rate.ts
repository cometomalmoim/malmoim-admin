export type SessionRateRow={confirmed_count:number|string;attended_count:number|string;unrecorded_count:number|string};
// Counts are person-session totals, not unique people or application conversion.
export function summarizeParticipationRate(rows:SessionRateRow[]){
 const confirmed=rows.reduce((sum,row)=>sum+Number(row.confirmed_count),0);
 const attended=rows.reduce((sum,row)=>sum+Number(row.attended_count),0);
 const unrecorded=rows.reduce((sum,row)=>sum+Number(row.unrecorded_count),0);
 return {confirmed,attended,unrecorded,sessions:rows.length,percent:confirmed>0?Math.round(attended/confirmed*1000)/10:null};
}
export function koreanDate(now=Date.now()){
 return new Date(now+9*60*60*1000).toISOString().slice(0,10);
}

export type DashboardSession=SessionRateRow&{id:string;event_id:string;event_title:string;event_slug:string;title:string;session_date:string};
export function groupParticipationTrends(rows:DashboardSession[]){
 const groups=new Map<string,DashboardSession[]>();
 for(const row of rows){const sessions=groups.get(row.event_id)??[];sessions.push(row);groups.set(row.event_id,sessions);}
 return [...groups.values()].map(sessions=>{
  const sorted=[...sessions].sort((a,b)=>b.session_date.localeCompare(a.session_date)||a.id.localeCompare(b.id));
  return {eventId:sorted[0].event_id,title:sorted[0].event_title,slug:sorted[0].event_slug,lastDate:sorted[0].session_date,sessions:sorted,totals:summarizeParticipationRate(sorted)};
 }).sort((a,b)=>b.lastDate.localeCompare(a.lastDate)||a.eventId.localeCompare(b.eventId));
}
export function summarizeParticipants(rows:{attendance_count:number|string}[]){
 const participants=rows.filter(row=>Number(row.attendance_count)>0).length;
 const repeat=rows.filter(row=>Number(row.attendance_count)>1).length;
 return {participants,repeat,firstOnly:participants-repeat,repeatPercent:participants?Math.round(repeat/participants*1000)/10:null};
}
