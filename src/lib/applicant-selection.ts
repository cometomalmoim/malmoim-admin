export type ApplicantSelection={id:string;source:string;event_id:string;revision:number;archive_revision:number};
export const applicantKey=(row:Pick<ApplicantSelection,'id'|'source'>)=>`${row.source}:${row.id}`;
export function archiveSelection(items:ApplicantSelection[]){
 if(!Array.isArray(items)||items.length<1||items.length>25)throw new Error('invalid');
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if(items.some(x=>!x||!uuid.test(x.id)||!uuid.test(x.event_id)||!['manual','registration','season9'].includes(x.source)||!Number.isSafeInteger(x.revision)||x.revision<0||!Number.isSafeInteger(x.archive_revision)||x.archive_revision<0)||new Set(items.map(applicantKey)).size!==items.length)throw new Error('invalid');
 return items.map(({id,source,event_id,revision,archive_revision})=>({id,source,event_id,revision,archive_revision}));
}
