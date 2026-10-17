import { applicantKey, type TargetRequest } from './signing-targets.ts';
export type RequestTransaction = {
 list():TargetRequest[];
 get(id:string):TargetRequest|undefined;
 save(request:TargetRequest):void;
 replay(key:string):{payload:string;ids:string[]}|undefined;
 remember(key:string,value:{payload:string;ids:string[]}):void;
};
// Async transaction boundary is intentional: a future DB adapter can use row locks
// and UNIQUE constraints without turning browser memory into the source of truth.
export interface RequestRepository {
 transaction<T>(work:(tx:RequestTransaction)=>Promise<T>|T):Promise<T>;
 list(eventIds:string[]):Promise<TargetRequest[]>;
 get(id:string,eventIds:string[]):Promise<TargetRequest|undefined>;
}
export class MemoryRequestRepository implements RequestRepository {
 private rows=new Map<string,TargetRequest>();
 private replays=new Map<string,{payload:string;ids:string[]}>();
 private queue:Promise<unknown>=Promise.resolve();
 transaction<T>(work:(tx:RequestTransaction)=>Promise<T>|T):Promise<T>{
  const task=this.queue.then(async()=>{
   const draft=new Map([...this.rows].map(([k,v])=>[k,structuredClone(v)]));
   const replayDraft=structuredClone(this.replays);
   const tx:RequestTransaction={replay:key=>replayDraft.get(key),remember:(key,value)=>{replayDraft.set(key,structuredClone(value));},list:()=>structuredClone([...draft.values()]),get:id=>{const row=draft.get(id);return row?structuredClone(row):undefined;},save:row=>{
    const old=draft.get(row.id);
    if(old?.status==='completed'&&JSON.stringify(old)!==JSON.stringify(row))throw new Error('COMPLETED_IMMUTABLE');
    if([...draft.values()].some(r=>r.id!==row.id&&applicantKey(r.key)===applicantKey(row.key)&&r.document.id===row.document.id))throw new Error('DUPLICATE_REQUEST');
    draft.set(row.id,structuredClone(row));
   }};
   const result=await work(tx);this.rows=draft;this.replays=replayDraft;return result;
  });this.queue=task.catch(()=>undefined);return task;
 }
 async list(eventIds:string[]){await this.queue;return structuredClone([...this.rows.values()].filter(r=>eventIds.includes(r.key.event_id)));}
 async get(id:string,eventIds:string[]){return (await this.list(eventIds)).find(r=>r.id===id);}
}
export function reissueDecision(r:TargetRequest){return r.status==='completed'?{allowed:false,code:'COMPLETED_IMMUTABLE'}:r.status==='pending'?{allowed:false,code:'ACTIVE_REQUEST_EXISTS'}:{allowed:true,code:'REQUIRES_LATEST_ELIGIBILITY_AND_CONTACT_CHECK'};}
