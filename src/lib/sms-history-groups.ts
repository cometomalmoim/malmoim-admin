type HistoryRow={event_id:string|null;template_id:string|null;kind:string;language:string|null;state:string};
export function smsHistoryGroups<T extends HistoryRow>(rows:T[]){
 const groups=new Map<string,T[]>();
 for(const row of rows){const key=JSON.stringify([row.event_id,row.template_id,row.kind,row.language]);const group=groups.get(key);if(group)group.push(row);else groups.set(key,[row]);}
 return Array.from(groups,([key,items])=>({key,items,delivered:items.filter(item=>item.state==='delivered').length,failed:items.filter(item=>item.state==='failed').length,unresolved:items.filter(item=>!['delivered','failed','cancelled'].includes(item.state)).length}));
}
