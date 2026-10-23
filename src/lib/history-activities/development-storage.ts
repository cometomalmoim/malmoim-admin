import 'server-only';
import {request} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createIndependentStorageAdapter,type IndependentTarget} from './independent-storage-adapter';
import type {ActivityStorageCommand,StoredActivity} from './activity-storage';
/** Explicit local lab pin. No environment values or production client imports.
 * The separate broker owns all auth/Storage secrets; Docker transport is LOCAL ONLY.
 * Removing this file + the route/panel disconnects this integration. */
const root='/private/tmp/malmoim-photo-integration-025aae9c';
export const developmentPhotoCookie='photo_integration_025aae9c';
export async function developmentBroker<T>(payload:unknown):Promise<T>{
 if(process.env.NODE_ENV!=='development')throw Error('disabled');
 return new Promise((resolve,reject)=>{const req=request({socketPath:root+'/broker.sock',path:'/',method:'POST',headers:{'content-type':'application/json'},timeout:20000},res=>{let data='';res.on('data',c=>{data+=c;if(data.length>200000)req.destroy();});res.on('end',()=>{try{if(res.statusCode!==200)throw Error();resolve(JSON.parse(data));}catch{reject(Error('Independent storage unavailable'));}});});req.on('timeout',()=>req.destroy());req.on('error',()=>reject(Error('Independent storage unavailable')));req.end(JSON.stringify(payload));});
}
export async function developmentStorage(session:string){
 if(process.env.NODE_ENV!=='development')return createIndependentStorageAdapter();
 const target:IndependentTarget=JSON.parse(await readFile(root+'/target.json','utf8'));
 if(target.projectId!=='malmoim-photo-integration-025aae9c'||target.apiUrl!=='http://127.0.0.1:58421'||target.dbPort!==58422)throw Error('target');
 return createIndependentStorageAdapter({target,inspectTarget:()=>developmentBroker({op:'target'}),
 administrator:()=>developmentBroker({op:'admin',session}),
 execute:(_actorId,command:ActivityStorageCommand)=>developmentBroker<{status:'recorded';activity:StoredActivity}|{status:'conflict'|'denied'|'uncertain'}>({op:'command',session,command}),
 // Anonymous reads use the separate public-photos route and public-read-only broker role.
 // Never reuse this administrator-session adapter as a public fallback.
 publicGallery:async()=>{throw Error('Public access disabled');},
 });
}
