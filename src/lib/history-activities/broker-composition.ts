import 'server-only';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createPhotoBrokerHandler,BrokerFault,type PhotoBrokerPorts,type BrokerOperation} from './service-handler';
import type {OidcDecision} from './broker-oidc';
import {createPhotoWorkerConnection,type WorkerAdapters,type PhotoPool} from './server-db';
import {createServerReceiptResolver,createReceiptVerifiedFinalizer,type ReceiptResolverPorts} from './server-receipts';
import {createReceiptGenerationRecovery,createGenerationFinalizer,type GenerationPorts,type GenerationRequest} from './receipt-generations';
import {createStorageTokenIssuer,createIssuerBackedPhotoStorage,createIssuerBackedPublicSigner,type StorageIssuerConfiguration,type StorageTokenIssuerPorts} from './storage-token-issuer';
import {createPublishedPhotoReader,type PublishedSnapshot} from './limited-storage';
import type {VerifiedFinalizationPorts} from './verified-finalization';
export interface OperationalBrokerDependencies {
 identity:{authenticate(header:string|null):Promise<OidcDecision>;administrator(session:string):Promise<{actorId:string}|null>};
 /** Operator supplies audited restricted adapters; never a JSON-loaded user/role flag.
  * command must atomically enforce session/admin, CAS, IDs and operation allowlist.
  * No arbitrary SQL or table interface is exposed by this composition. */
 database?:{
  catalog?:NonNullable<PhotoBrokerPorts['catalog']>;publishedIds?:NonNullable<PhotoBrokerPorts['publishedIds']>;
  command:NonNullable<PhotoBrokerPorts['command']>;
  load:VerifiedFinalizationPorts['jobs']['load'];attest:VerifiedFinalizationPorts['jobs']['attest'];
  snapshot(activity:string):Promise<PublishedSnapshot|null>;
  metadata:NonNullable<PhotoBrokerPorts['publicMetadata']>;
  close?():Promise<void>;
 };
 /** Reuse the restricted PostgreSQL driver; source and authorization cannot be replaced
  * with a browser receipt. attachLifecycle is supplied below for process cleanup. */
 worker?:Omit<WorkerAdapters,'authorize'|'receipts'|'attachLifecycle'>;
 receipts?:ReceiptResolverPorts['source']&{close?():Promise<void>};
 generations?:Pick<GenerationPorts,'state'|'issue'>&{close?():Promise<void>};
 issuer?:{config:StorageIssuerConfiguration;ports:Omit<StorageTokenIssuerPorts,'workload'|'administrator'|'decode'>};
 decode?:VerifiedFinalizationPorts['decode'];
 /** Real audit of dependencies/identities, not merely config presence. */
 readiness?():Promise<boolean>;
 /** Pools/HTTPS agents/key clients created by operator bootstrap, deduplicated on close. */
 resources?:{close():Promise<void>}[];
 /** Server-only bounded deadline; timeout never proves remote work rolled back. */
 requestTimeoutMs?:number;
}
type Context={authorization:string|null;session:string;signal:AbortSignal};
/** No default credentials, signing, network or environment activation. Dependencies are
 * explicitly provided trusted SERVER objects. Each HTTP call has isolated async context. */
export function createOperationalPhotoBroker(d?:OperationalBrokerDependencies){
 const local=new AsyncLocalStorage<Context>(),controllers=new Set<AbortController>(),pools=new Set<PhotoPool>(),opening=new Set<Promise<PhotoPool>>();let stopping=false,closing:Promise<void>|undefined,latePoolCloseFailed=false;
 const context=()=>{const c=local.getStore();if(stopping||!c||c.signal.aborted)throw new BrokerFault('unavailable');return c;};
 const authenticate=async(header:string|null):Promise<OidcDecision>=>{
  if(!d||stopping)return {status:'unavailable'};const c=local.getStore();if(!c||c.signal.aborted||header!==c.authorization)return {status:'unavailable'};
  try{return await d.identity.authenticate(header);}catch{return {status:'unavailable'};}
 };
 const administrator=async(session:string)=>{try{const c=context();if(session!==c.session||(await authenticate(c.authorization)).status!=='verified')return null;return await d!.identity.administrator(session);}catch{return null;}};
 const authorize=async()=>{const c=context();const a=await administrator(c.session);if(!a)throw new BrokerFault('denied');context();return a;};
 const storageIssuer=d?.issuer&&d.decode?createStorageTokenIssuer(d.issuer.config,{...d.issuer.ports,decode:d.decode,workload:()=>authenticate(context().authorization),administrator:()=>administrator(context().session)}):createStorageTokenIssuer();
 const storage=createIssuerBackedPhotoStorage(storageIssuer);
 const receiptPorts:ReceiptResolverPorts|undefined=d?.receipts&&d.decode?{source:d.receipts,workload:()=>authenticate(context().authorization),administrator:()=>administrator(context().session),readFinal:storage.readFinal,decode:d.decode}:undefined;
 const worker=d?.worker&&receiptPorts?createPhotoWorkerConnection({...d.worker,authorize:async()=>authorize(),receipts:createServerReceiptResolver(receiptPorts),driver:{open:options=>{context();const operation=(async()=>{const pool=await d.worker!.driver.open(options);if(stopping){try{await pool.close();}catch{latePoolCloseFailed=true;}throw new BrokerFault('unavailable');}return pool;})();opening.add(operation);operation.then(()=>opening.delete(operation),()=>opening.delete(operation));return operation;}},attachLifecycle:p=>{if(stopping)throw new BrokerFault('unavailable');pools.add(p);}}):createPhotoWorkerConnection();
 const canFinalize=!!(d?.database&&d.worker&&d.receipts&&d.issuer&&d.decode);
 const finalization:VerifiedFinalizationPorts|undefined=canFinalize?{
  authenticate,administrator,decode:d!.decode!,storage,
  jobs:{load:async(id,actor)=>{const a=await authorize();if(a.actorId!==actor)throw new BrokerFault('denied');return d!.database!.load(id,actor);},attest:async e=>{const a=await authorize();if(e.actorId!==a.actorId)throw new BrokerFault('denied');return d!.database!.attest(e);},commit:async p=>{await authorize();const r=await worker.commit(p,context());if(r.status!=='recorded')throw new BrokerFault(r.status==='denied'?'denied':r.status==='conflict'?'conflict':'unavailable');}},
 }:undefined;
 const ordinary=finalization&&d?.receipts?createReceiptVerifiedFinalizer(finalization,d.receipts):undefined;
 const generationPorts=finalization&&d?.generations?{...d.generations,finalization}:undefined;
 const generation= generationPorts&&d?.receipts?createGenerationFinalizer(generationPorts,d.receipts):undefined;
 const recovery=createReceiptGenerationRecovery(generationPorts);
 const publicReader=d?.database&&d.issuer?createPublishedPhotoReader({authenticate,snapshot:async id=>{context();return d.database!.snapshot(id);},sign:createIssuerBackedPublicSigner(storageIssuer)},d.issuer.config.storageOrigin):createPublishedPhotoReader();
 const ports:PhotoBrokerPorts={
  authenticate,administrator,
  readiness:async()=>{if(stopping||!d?.readiness||!canFinalize||!d.generations)return false;try{return await d.readiness()===true;}catch{return false;}},
  ...(d?.database?{
   ...(d.database.catalog?{catalog:async(session:string)=>{await authorize();return d.database!.catalog!(session);}}:{}),
   ...(d.database.publishedIds?{publishedIds:async()=>{const c=context();if((await authenticate(c.authorization)).status!=='verified')throw new BrokerFault('denied');return d.database!.publishedIds!();}}:{}),
   command:async(op:BrokerOperation,p:Record<string,unknown>,session:string)=>{const c=context();if(session!==c.session||!['create','reserve','inspect','layout','visibility','claim_permit'].includes(op))throw new BrokerFault('denied');await authorize();return d.database!.command(op,p,session);},
   job:async(id:string,actor:string)=>{if((await authorize()).actorId!==actor)throw new BrokerFault('denied');return d.database!.load(id,actor);},
   publicMetadata:async(id:string)=>{const c=context();if((await authenticate(c.authorization)).status!=='verified')return null;return d.database!.metadata(id);},
  }:{}),
  ...(d?.database&&d.issuer&&d.decode?{storageOrigin:d.issuer.config.storageOrigin,permit:async(job:Parameters<typeof storage.permit>[0])=>{await authorize();return storage.permit(job);}}:{}),
  ...(ordinary?{finalize:async(input:unknown,auth:{authorization:string|null;userSession:string})=>{
   const c=context();if(auth.authorization!==c.authorization||auth.userSession!==c.session)throw new BrokerFault('denied');await authorize();
   return ordinary.run(input,auth);
  }}:{}),
  ...(d?.database&&d.issuer?{publicRead:async(id:string,header:string|null)=>{context();return publicReader.read(id,header);}}:{}),
 };
 const handler=createPhotoBrokerHandler(d?ports:undefined);
 const uncertain=()=>Response.json({code:'RESULT_UNCERTAIN'},{status:503,headers:{'Cache-Control':'no-store'}});
 async function dispatch(request:Request){
  if(stopping)return uncertain();const controller=new AbortController();controllers.add(controller);
  const abort=()=>controller.abort();request.signal.addEventListener('abort',abort,{once:true});if(request.signal.aborted)abort();
  const ms=d?.requestTimeoutMs??15000;let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   if(!Number.isSafeInteger(ms)||ms<10||ms>15000)return uncertain();
   const cancelled=new Promise<Response>(resolve=>{controller.signal.addEventListener('abort',()=>resolve(uncertain()),{once:true});if(controller.signal.aborted)resolve(uncertain());});
   timer=setTimeout(abort,ms);
   const work=local.run({authorization:request.headers.get('authorization'),session:request.headers.get('x-photo-user-session')??'',signal:controller.signal},()=>handler(request));
   return await Promise.race([work,cancelled]);
  }finally{if(timer)clearTimeout(timer);request.signal.removeEventListener('abort',abort);controllers.delete(controller);}
 }
 async function serverOperation<T>(auth:{authorization:string|null;userSession:string},action:()=>Promise<T>,unavailable:T):Promise<T>{
  if(stopping)return unavailable;const c=new AbortController();controllers.add(c);let timer:ReturnType<typeof setTimeout>|undefined;
  try{const ms=d?.requestTimeoutMs??15000;if(!Number.isSafeInteger(ms)||ms<10||ms>15000)return unavailable;
   const interrupted=new Promise<T>(resolve=>c.signal.addEventListener('abort',()=>resolve(unavailable),{once:true}));timer=setTimeout(()=>c.abort(),ms);
   return await Promise.race([local.run({authorization:auth.authorization,session:auth.userSession,signal:c.signal},action),interrupted]);
  }finally{if(timer)clearTimeout(timer);controllers.delete(c);}
 }
 return {...ports,handleRequest:dispatch,
  /** Explicit server-only recovery. Not a new HTTP endpoint or automatic renewal. */
  async revalidateGeneration(input:GenerationRequest,auth:{authorization:string|null;userSession:string}){
   if(stopping)return {status:'disabled'} as const;
   return serverOperation(auth,()=>recovery.revalidate(input,auth),{status:'manual_required'});
  },
  async resumeGeneration(input:unknown,auth:{authorization:string|null;userSession:string}){
   if(!generation||stopping)return {status:'disabled'};
   return serverOperation(auth,()=>generation.run(input,auth),{status:'uncertain'});
  },
  close(){if(!closing){stopping=true;for(const c of controllers)c.abort();const resources=new Set<{close():Promise<void>}>([...pools,...(d?.resources??[])]);
   for(const resource of [d?.database,d?.receipts,d?.generations])if(resource?.close)resources.add(resource as {close():Promise<void>});
   closing=(async()=>{let timer:ReturnType<typeof setTimeout>|undefined;
    const cleanup=(async()=>{
     // Wait for in-progress opens: worker factory closes a late pool if lifecycle attach fails.
     await Promise.allSettled([...opening]);
     for(const p of pools)resources.add(p);
     const results=await Promise.allSettled([...resources].map(r=>Promise.resolve().then(()=>r.close())));
     if(latePoolCloseFailed||results.some(r=>r.status==='rejected'))throw Error('Photo broker resource cleanup incomplete');
    })();
    try{await Promise.race([cleanup,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Photo broker resource cleanup incomplete')),2000);})]);}finally{if(timer)clearTimeout(timer);}
   })();
  }return closing;},
 };
}
