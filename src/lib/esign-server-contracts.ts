import {applicantKey,type ApplicantKey,type TargetApplicant,type TargetRequest} from './signing-targets.ts';

export type EsignActor={id:string;eventIds:readonly string[]};
/** Production adapter must derive identity from a verified server session, never headers supplied by the browser. */
export interface AdminSessionAdapter { currentAdmin():Promise<EsignActor|null> }
export const denyAdminSession:AdminSessionAdapter={async currentAdmin(){return null;}};
export type ApplicantSnapshot=TargetApplicant&{contactType:string;archived?:boolean|null};
export interface EsignApplicantReader { find(key:ApplicantKey):Promise<ApplicantSnapshot|undefined> }
export function validApplicantKey(value:unknown,mode:'database'|'preview'='database'):value is ApplicantKey{
 if(!value||typeof value!=='object')return false;
 const v=value as Record<string,unknown>;
 const id=(x:unknown)=>typeof x==='string'&&(mode==='database'?/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x):/^[a-zA-Z0-9-]{1,80}$/.test(x));
 return id(v.event_id)&&id(v.application_id)&&['season9','registration','manual'].includes(String(v.source));
}
/** Temporary preview policy, not an approved operating policy. Unknown archive state is held for real adapters. */
export function signingEligibility(a:ApplicantSnapshot,event:string,requireArchive=false):string{
 if(a.event_id!==event)return 'EVENT_MISMATCH';
 if(a.archived===true)return 'ARCHIVED';
 if(requireArchive&&a.archived!==false)return 'ARCHIVE_POLICY_HOLD';
 if(a.selectionRevoked)return 'ACCEPTANCE_REVOKED';
 if(a.status==='withdrawn')return 'WITHDRAWN';
 if(a.confirmation==='cancelled')return 'PARTICIPATION_CANCELLED';
 if(!['received','reviewing','accepted','waitlisted','declined','withdrawn'].includes(a.status))return 'UNKNOWN_APPLICATION_STATUS';
 if(a.confirmation!==null&&!['unconfirmed','confirmed','cancelled'].includes(a.confirmation))return 'UNKNOWN_CONFIRMATION';
 if(['waitlisted','declined'].includes(a.status)&&a.confirmation==='confirmed')return 'STATUS_CONFLICT';
 if(a.status==='waitlisted')return 'WAITLISTED';
 if(a.status==='declined')return 'DECLINED';
 if(a.status!=='accepted')return a.confirmation==='confirmed'?'POLICY_HOLD':'NOT_ACCEPTED_OR_CONFIRMED';
 if(a.contactType!=='phone'||!a.phone||!/^\+?[0-9]{8,15}$/.test(a.phone.replace(/[ ()-]/g,'')))return 'INVALID_PHONE';
 return 'OK';
}
/** Preparation-only lookup boundary. No production API or Supabase implementation is installed. */
export async function inspectSigningTarget(auth:AdminSessionAdapter,reader:EsignApplicantReader,key:unknown){
 const actor=await auth.currentAdmin();if(!actor)return {code:'UNAUTHENTICATED'};
 if(!validApplicantKey(key))return {code:'INVALID_APPLICANT_KEYS'};
 if(!actor.eventIds.includes(key.event_id))return {code:'EVENT_FORBIDDEN'};
 const row=await reader.find(key);if(!row)return {code:'APPLICANT_NOT_FOUND'};
 if(applicantKey(row)!==applicantKey(key))return {code:'EVENT_MISMATCH'};
 return {code:signingEligibility(row,key.event_id,true)};
}
export type ReplayRecord={payload:string;ids:string[]};
export interface AsyncRequestTransaction{
 list():Promise<TargetRequest[]>;get(id:string):Promise<TargetRequest|undefined>;
 save(row:TargetRequest):Promise<void>;replay(key:string):Promise<ReplayRecord|undefined>;
 remember(key:string,value:ReplayRecord):Promise<void>;
}
/** Implement using one DB transaction/RPC, not separate HTTP calls for each method. */
export interface AsyncRequestRepository{
 transaction<T>(work:(tx:AsyncRequestTransaction)=>Promise<T>):Promise<T>;
 list(eventIds:string[]):Promise<TargetRequest[]>;
 get(id:string,eventIds:string[]):Promise<TargetRequest|undefined>;
}
