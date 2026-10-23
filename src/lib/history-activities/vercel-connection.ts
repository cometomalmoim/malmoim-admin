import 'server-only';
import {createVercelOidcTransport,type VercelOidcTransportOptions} from './vercel-oidc-transport';
import {getPhotoAdministratorSession} from './vercel-admin-session';
import {getPhotoVercelOidcToken} from '../../../services/history-photo-broker/vercel-token.cjs';
import type {createPhotoWorkerConnection,WorkerCommand} from './server-db';
import {verifyPhotoAdministrator} from './server-admin';
import {createPhotoCapabilities,type CapabilityAdapters,type PhotoBinding,type MachinePurpose,type StorageAction} from './server-capabilities';
/** Node-only preparation. No environment reads, driver, HTTP endpoint or signer.
 * Real ports must authenticate Vercel workload identity, audit restricted DB/Storage
 * identities and verify revocation. A browser flag or shared service_role is invalid.
 * Capability wiring and production review are outstanding; routes never use this.
 * The optional OIDC transport below performs authentication probes only.
 */
export const PHOTO_DEPLOYMENT_VARIABLES=Object.freeze({
 database:'HISTORY_PHOTO_WORKER_DATABASE_URL',
 brokerOrigin:'HISTORY_PHOTO_BROKER_ORIGIN',
 audience:'HISTORY_PHOTO_BROKER_AUDIENCE',
});
export interface VercelPhotoTransport extends Omit<CapabilityAdapters,'admin'> {
 /** Must verify remote authenticated issuer/audience/project and current policy, not
  * echo configuration or accept request-provided role/claims. No implementation yet. */
 deploymentIdentity():Promise<{runtime:'nodejs';projectRef:string;origin:string;workloadAuthentication:'verified'}|null>;
}
export function createVercelPhotoConnection(options?:{
 projectRef:string;brokerOrigin:string;transport:VercelPhotoTransport;
 worker?:Pick<ReturnType<typeof createPhotoWorkerConnection>,'commit'>;
}){
 const gates=createPhotoCapabilities(options?{...options.transport,admin:()=>verifyPhotoAdministrator()}:undefined);
 async function ready(){
  if(!options||!/^[a-z0-9]{20}$/.test(options.projectRef))return false;
  try{const u=new URL(options.brokerOrigin);if(u.protocol!=='https:'||u.origin!==options.brokerOrigin||u.username||u.password)return false;
   const actual=await options.transport.deploymentIdentity();return actual?.runtime==='nodejs'&&actual.projectRef===options.projectRef&&actual.origin===options.brokerOrigin&&actual.workloadAuthentication==='verified';
  }catch{return false;}
 }
 return {
  /** Server-held receipt path; legacy capability bindings are not completion evidence. */
  async commit(command:WorkerCommand,context:unknown){
   if(!await ready()||!options?.worker)return {status:'disabled'} as const;
   if(!await verifyPhotoAdministrator())return {status:'denied'} as const;
   return options.worker.commit(command,context);
  },
  async machineContext(){if(!await ready())return null;return gates.issueMachineContext();},
  async database(name:string,binding:PhotoBinding,context?:object){
   if(!await ready())return {status:'disabled'} as const;
   // Generic photo bindings contain no one-use receipt; use commit() instead.
   if(name==='commit_finalization')return {status:'denied'} as const;
   return gates.database(name,binding,undefined,context);
  },
  async storage(action:StorageAction,binding:PhotoBinding,context:object){
   if(!await ready())return {status:'disabled'} as const;
   return gates.storage(action,binding,undefined,context);
  },
 };
}
// Separate authenticated machine purposes; do not share one privileged connection.
export type VercelPhotoPurpose=MachinePurpose;

/** Optional request-time SDK bridge. Not wired into routes or capability readiness;
 * OIDC success alone never activates any photo operation. */
export function createVercelPhotoOidcAdapter(options?:VercelOidcTransportOptions){
 return createVercelOidcTransport(options,options?{getToken:getPhotoVercelOidcToken,administrator:getPhotoAdministratorSession}:undefined);
}
