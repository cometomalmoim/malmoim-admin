// Server-side adapter contract only. No Supabase client, credentials, or network calls.
import {normalizeApplicantKey,type ApplicantSnapshot,type EsignApplicantReader as EsignApplicantReaderContract} from './esign-server-contracts.ts';
import type {ApplicantKey} from './signing-targets.ts';
export type EsignLookupTable='recruitment_events'|'event_application_admin_list'|'event_participation';
export interface EsignSnapshotQuery {
 one(table:EsignLookupTable,columns:readonly string[],filters:Readonly<Record<string,string>>):Promise<unknown>;
}
/** Must execute all reads in a consistent server-owned snapshot/RPC. Independent HTTP reads do not satisfy this contract. */
export interface EsignSnapshotSource {
 read<T>(work:(query:EsignSnapshotQuery)=>Promise<T>):Promise<T>;
}
export class ApplicantLookupError extends Error{}
export type CurrentApplicantSnapshot=ApplicantSnapshot&{participationRevision:number|null;archiveRevision:number};
const object=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new ApplicantLookupError('APPLICANT_DATA_MISMATCH');return v as Record<string,unknown>;};
const revision=(v:unknown)=>{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw new ApplicantLookupError('INVALID_APPLICANT_REVISION');return v;};
function matches(row:Record<string,unknown>,key:ApplicantKey,idColumn:string){
 const mapped=normalizeApplicantKey({event_id:row.event_id,source:row.source,application_id:row[idColumn]});
 if(mapped.event_id!==key.event_id||mapped.source!==key.source||mapped.application_id!==key.application_id)throw new ApplicantLookupError('APPLICANT_DATA_MISMATCH');
}
export class EsignApplicantReader implements EsignApplicantReaderContract {
 constructor(privateSource:EsignSnapshotSource){this.source=privateSource;}
 private source:EsignSnapshotSource;
 async find(input:ApplicantKey):Promise<CurrentApplicantSnapshot|undefined>{
  const key=normalizeApplicantKey(input);
  try{return await this.source.read(async query=>{
   const event=await query.one('recruitment_events',['id'],{id:key.event_id});
   if(event===null)return undefined;
   const eventRow=object(event);
   if(typeof eventRow.id!=='string'||eventRow.id.toLowerCase()!==key.event_id)throw new ApplicantLookupError('EVENT_DATA_MISMATCH');
   const raw=await query.one('event_application_admin_list',['id','event_id','source','name','contact','contact_type','status','revision','is_archived','archive_revision'],{event_id:key.event_id,source:key.source,id:key.application_id});
   if(raw===null)return undefined;
   const a=object(raw);matches(a,key,'id');
   if(typeof a.name!=='string'||!a.name.trim()||a.name.length>100||typeof a.status!=='string'||!['received','reviewing','accepted','waitlisted','declined','withdrawn'].includes(a.status)||typeof a.contact_type!=='string'||!['phone','instagram'].includes(a.contact_type)||(a.contact!==null&&typeof a.contact!=='string'))throw new ApplicantLookupError('APPLICANT_DATA_MISMATCH');
   if(a.is_archived!==null&&a.is_archived!==undefined&&typeof a.is_archived!=='boolean')throw new ApplicantLookupError('APPLICANT_DATA_MISMATCH');
   const managementRevision=revision(a.revision),archiveRevision=revision(a.archive_revision);
   const participation=await query.one('event_participation',['event_id','source','application_id','confirmation','revision'],{event_id:key.event_id,source:key.source,application_id:key.application_id});
   let confirmation:string|null=null,participationRevision:number|null=null;
   if(participation!==null){const p=object(participation);matches(p,key,'application_id');
    if(typeof p.confirmation!=='string'||!['unconfirmed','confirmed','cancelled'].includes(p.confirmation))throw new ApplicantLookupError('PARTICIPATION_DATA_MISMATCH');
    confirmation=p.confirmation;participationRevision=revision(p.revision);
   }
   return {...key,name:a.name,status:a.status,confirmation,phone:a.contact_type==='phone'?a.contact as string|null:null,contactType:a.contact_type,revision:managementRevision,archived:a.is_archived as boolean|null|undefined,archiveRevision,participationRevision,selectionRevoked:false};
   // No separate production "acceptance revoked" flag exists in the inspected schema.
   // Latest effective status is authoritative; never derive acceptance from phone/name.
  });}catch(error){if(error instanceof ApplicantLookupError)throw error;throw new ApplicantLookupError('APPLICANT_LOOKUP_FAILED');}
 }
}
