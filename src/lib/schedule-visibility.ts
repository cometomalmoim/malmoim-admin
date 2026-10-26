// Keep manual operations independent; linked rows follow the source event lifecycle.
export function visibleEventSchedules<T extends {source_kind:string;event_id:string|null;hidden_at:string|null}>(rows:T[],events:{id:string}[]):T[]{
 const activeIds=new Set(events.map(event=>event.id));
 return rows.filter(row=>!row.hidden_at&&(row.source_kind==='manual'||(row.event_id!==null&&activeIds.has(row.event_id))));
}
