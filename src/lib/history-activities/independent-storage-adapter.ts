import 'server-only';
import {activityPhotoPolicy} from './photo-policy';
import type {ActivityStorageAdapter,ActivityStorageCommand,StoredActivity,PublicActivityPhotos} from './activity-storage';
export type IndependentTarget = {
 projectId:string;apiUrl:string;dbHost:'127.0.0.1';dbPort:number;
 dbContainerId:string;apiContainerId:string;
};
export interface IndependentStoragePorts {
 /** Server-owned configuration, never HTTP input. No environment reads here. */
 target:IndependentTarget;
 /** Future control-plane adapter must independently inspect project/container/port
  * bindings, schema and restricted DB/Storage identities, without trusting flags. */
 inspectTarget():Promise<IndependentTarget|null>;
 administrator(context:unknown):Promise<{actorId:string}|null>;
 /** Transactional administrator recheck, CAS, idempotency and aggregate limits
  * belong here, reusing server-capabilities/journal. No implementation installed.
  * Finalize independently downloads/validates source + final bytes/hash and records
  * recovery before copying; never accepts browser evidence or reports termination.
  * Retry only after trusted inspection proves safe; publication all-final only. */
 execute(actorId:string,command:ActivityStorageCommand):Promise<
  {status:'recorded';activity:StoredActivity}|{status:'conflict'|'denied'|'uncertain'}>;
 /** Trusted adapter supplies verified snapshot plus short-lived final read DTO.
  * This transport must recheck publication while signing, with no temp URL fallback. */
 publicGallery():Promise<{record:StoredActivity;view:PublicActivityPhotos;readUrlTtl:60}[]>;
}
const id=(s:unknown)=>typeof s==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(s);
function targetAllowed(t:IndependentTarget){
 try {const u=new URL(t.apiUrl);return u.origin===t.apiUrl&&u.hostname==='127.0.0.1'&&u.protocol==='http:'&&
 Number(u.port)>1024&&t.dbHost==='127.0.0.1'&&Number.isInteger(t.dbPort)&&t.dbPort>1024&&t.dbPort<65536&&
 ![54321,54322,55421,55422,56421,56422,57421,57422].includes(Number(u.port))&&
 ![54321,54322,55421,55422,56421,56422,57421,57422].includes(t.dbPort)&&Number(u.port)!==t.dbPort&&
 /^malmoim-photo-integration-[a-z0-9-]+$/.test(t.projectId)&&[t.dbContainerId,t.apiContainerId].every(v=>/^[a-f0-9]{64}$/.test(v));}catch{return false;}
}
function valid(c:ActivityStorageCommand){
 if(!c||!id(c.requestId))return false;
 const allowed:Record<string,string[]>={create:['title','date','description'],reserve:['activityId','revision','files'],inspect:['activityId','revision','photoId'],finalize:['activityId','revision','photoId'],retry:['activityId','revision','photoId'],layout:['activityId','revision','order','coverId'],visibility:['activityId','revision','published']};
 if(!allowed[c.operation]||Object.keys(c).some(k=>!['operation','requestId',...allowed[c.operation]].includes(k)))return false;
 if(c.operation==='create')return [c.title,c.date,c.description].every(v=>typeof v==='string'&&v.length<=2000)&&c.title.trim().length>0;
 if(!id(c.activityId)||!Number.isSafeInteger(c.revision)||c.revision<0)return false;
 if(c.operation==='reserve')return Array.isArray(c.files)&&c.files.length>0&&c.files.length<=activityPhotoPolicy.maxFiles&&new Set(c.files.map(f=>f.clientId)).size===c.files.length&&c.files.every(f=>id(f.clientId)&&Object.keys(f).sort().join(',')==='clientId,mime,size'&&Number.isSafeInteger(f.size)&&f.size>0&&f.size<=activityPhotoPolicy.maxBytes&&(activityPhotoPolicy.mimeTypes as readonly string[]).includes(f.mime))&&c.files.reduce((s,f)=>s+f.size,0)<=activityPhotoPolicy.totalBytes;
 if(c.operation==='layout')return Array.isArray(c.order)&&c.order.length>0&&c.order.length<=10&&c.order.every(id)&&new Set(c.order).size===c.order.length&&c.order.includes(c.coverId);
 if(c.operation==='visibility')return typeof c.published==='boolean';
 return id(c.photoId);
}
/** No driver, broker, credentials or network implementation. Not connected to a Route.
 * Existing 3001/3002/3003/broker endpoints explicitly excluded. */
export function createIndependentStorageAdapter(ports?:IndependentStoragePorts):ActivityStorageAdapter {
 const target=ports?Object.freeze({...ports.target}):null;
 async function ready(){if(!ports||!target||!targetAllowed(target))return false;const actual=await ports.inspectTarget();return !!actual&&Object.keys(target).every(k=>actual[k as keyof IndependentTarget]===target[k as keyof IndependentTarget]);}
 return {
 async execute(context,command){
 if(!ports)return {status:'disabled'};
 try {const snapshot=structuredClone(command);if(!await ready())return {status:'denied'};const admin=await ports.administrator(context);if(!admin)return {status:'denied'};
 if(!valid(snapshot))return {status:'invalid'};
 // Snapshot browser metadata before asynchronous boundaries; no File/Blob payload.
 return await ports.execute(admin.actorId,snapshot);
 }catch{return {status:'uncertain'};}
 },
 async publicGallery(){if(!ports)return {status:'disabled'};try{if(!await ready())return {status:'disabled'};const entries=await ports.publicGallery();
 const activities:PublicActivityPhotos[]=[];
 for(const {record:a,view,readUrlTtl} of entries){
 if(readUrlTtl!==60||a.source!=='independent-storage'||!a.published||!a.photos.length||a.photos.some(p=>p.state!=='final'||p.deletePending)||view.id!==a.id||view.coverId!==a.coverId||view.photos.map(p=>p.id).join(',')!==a.order.join(',')||!a.order.includes(a.coverId)||a.photos.length!==a.order.length)return {status:'uncertain'};
 // Project known public fields only: never spread server journal rows into responses.
 activities.push({id:view.id,title:view.title,date:view.date,description:view.description,coverId:view.coverId,photos:view.photos.map(p=>({id:p.id,src:p.src,alt:p.alt}))});
 }
 return {status:'recorded',activities};}catch{return {status:'uncertain'};}}
 };
}
