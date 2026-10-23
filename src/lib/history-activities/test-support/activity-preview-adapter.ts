/** Explicit TEST-MEMORY adapter. No server imports, credentials, persistence or IO.
 * Simulated states are never upload-journal/evidence proofs or production records.
 * Real connection remains behind the disabled upload API/server-capabilities boundary.
 */
import {activityPhotoPolicy} from '../photo-policy';
import type {Activity} from '@/app/(public)/history/manage-preview/activity-types';
import type {HistoryPhoto} from '@/app/(public)/history/history-data';
export type PreviewState='pending'|'retryable'|'uncertain'|'uploaded'|'final';
export type PreviewRecord={source:'test-memory';activity:Activity;order:string[];coverId:string;states:Record<string,PreviewState>;revision:number;published:boolean};
export function createActivityPreviewAdapter(mode?:'test'){
 if(mode!=='test')throw Error('Explicit test adapter required');
 const data=new Map<string,PreviewRecord>();const clone=<T,>(v:T):T=>structuredClone(v);
 function read(id:string){const r=data.get(id);if(!r)throw Error('테스트 활동을 찾지 못했습니다.');return r;}
 function change(id:string,revision:number,fn:(r:PreviewRecord)=>void){const old=read(id);if(old.revision!==revision)throw Error('다른 변경이 있습니다. 최신 목록에서 다시 시도해주세요.');const r=clone(old);fn(r);r.revision++;data.set(id,r);return clone(r);}
 return {
 list:()=>Array.from(data.values(),clone),
 save(activity:Activity,revision?:number){const assets=[activity.cover,...activity.additional];
 if(assets.length>activityPhotoPolicy.maxFiles||new Set(assets.map(a=>a.id)).size!==assets.length||assets.some(a=>!Number.isSafeInteger(a.size)||a.size<1||a.size>activityPhotoPolicy.maxBytes)||assets.reduce((n,a)=>n+a.size,0)>activityPhotoPolicy.totalBytes)throw Error('최대 10장·장당 4.5MB·합계 45MB를 확인해주세요.');
 const old=data.get(activity.id);if(old&&old.revision!==revision)throw Error('수정 충돌: 기존 상태를 유지합니다.');
 const record:PreviewRecord={source:'test-memory',activity:clone(activity),order:old?[...old.order.filter(id=>assets.some(a=>a.id===id)),...assets.filter(a=>!old.order.includes(a.id)).map(a=>a.id)]:assets.map(a=>a.id),coverId:activity.cover.id,states:Object.fromEntries(assets.map(a=>[a.id,old?.states[a.id]??'pending'])),published:false,revision:(old?.revision??-1)+1};data.set(activity.id,record);return clone(record);},
 layout(id:string,revision:number,order:string[],cover:string){return change(id,revision,r=>{if(order.length!==r.order.length||new Set(order).size!==order.length||order.some(p=>!r.order.includes(p))||!order.includes(cover))throw Error('사진 순서·대표 지정을 확인해주세요.');r.order=[...order];r.coverId=cover;});},
 transition(id:string,revision:number,photo:string,action:'send'|'fail'|'unknown'|'retry'|'finalize'){return change(id,revision,r=>{const state=r.states[photo];if(!state)throw Error('다른 사진의 상태는 바꿀 수 없습니다.');
 if(action==='retry'){if(state!=='retryable')throw Error('실패가 확실한 사진만 재시도할 수 있습니다.');r.states[photo]='uploaded';}
 else if(action==='finalize'){if(state!=='uploaded')throw Error('모의 전송 완료 후 확정할 수 있습니다.');r.states[photo]='final';}
 else{if(state!=='pending')throw Error('완료·불확실 사진은 재전송하지 않습니다.');r.states[photo]=action==='send'?'uploaded':action==='fail'?'retryable':'uncertain';}r.published=false;});},
 visibility(id:string,revision:number,published:boolean){return change(id,revision,r=>{if(published&&r.order.some(p=>r.states[p]!=='final'))throw Error('모든 사진이 모의 확정된 경우에만 테스트 갤러리에 표시합니다.');r.published=published;});},
 gallery():HistoryPhoto[]{return Array.from(data.values()).filter(r=>r.published&&r.order.every(p=>r.states[p]==='final')).map(r=>{const assets=[r.activity.cover,...r.activity.additional],cover=assets.find(a=>a.id===r.coverId)!;const slides=r.order.map(id=>{const a=assets.find(a=>a.id===id)!;return {src:a.url,alt:a.alt};});const base={id:r.activity.id,title:`[테스트] ${r.activity.title}`,date:r.activity.date,description:r.activity.description,src:cover.url,alt:cover.alt,slidePhotos:slides};return r.activity.category==='regular'?{...base,category:'regular',cohort:r.activity.cohort}:{...base,category:'special'};});},
 };
}
