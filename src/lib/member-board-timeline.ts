import type {AdminLog} from "./member-board-admin-model";

export type AdminTimelineEntry = {key:string;created_at:string} & (
 {kind:"receipt"} | {kind:"action";log:AdminLog}
);

function timestampParts(value:string){
 const milliseconds=Date.parse(value);
 // Date.parse truncates PostgreSQL's microseconds to milliseconds. Retain the
 // remaining precision before applying the ID tie-breaker. Offsets use epoch time.
 const fraction=/\.(\d+)(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.exec(value)?.[1]??"";
 return {milliseconds:Number.isFinite(milliseconds)?milliseconds:-Infinity,
  submillisecond:Number(fraction.padEnd(9,"0").slice(3,9))};
}

function newestFirst<T extends {key:string;created_at:string}>(entries:readonly T[]):T[]{
 return entries.map(entry=>({entry,time:timestampParts(entry.created_at)})).sort((a,b)=>{
  if(a.time.milliseconds!==b.time.milliseconds)return a.time.milliseconds>b.time.milliseconds?-1:1;
  if(a.time.submillisecond!==b.time.submillisecond)return b.time.submillisecond-a.time.submillisecond;
  return a.entry.key===b.entry.key?0:a.entry.key>b.entry.key?-1:1;
 }).map(({entry})=>entry);
}

export function sortAdminLogs(logs:readonly AdminLog[]):AdminLog[]{
 return newestFirst(logs.map(log=>({key:log.id,created_at:log.created_at,log}))).map(({log})=>log);
}

export function adminTimeline(logs:readonly AdminLog[]|null,receipt?:{id:string;created_at:string}):AdminTimelineEntry[]{
 // Both sources share one ordering rule. No in-place mutation of RPC responses
 // or request data: revisiting another report cannot change a previous timeline.
 const entries:AdminTimelineEntry[]=(logs??[]).map(log=>({key:"1:log:"+log.id,kind:"action",created_at:log.created_at,log}));
 if(receipt)entries.push({key:"0:receipt:"+receipt.id,kind:"receipt",created_at:receipt.created_at});
 return newestFirst(entries);
}
