"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {ActivityForm} from '@/app/(public)/history/manage-preview/activity-form';
import type {Activity,ActivityAsset} from '@/app/(public)/history/manage-preview/activity-types';
import type {ActivityResult} from '@/lib/history-activities/vercel-photo-client';
import {photoBrowser} from '@/lib/history-activities/photo-browser';
import '@/app/(public)/history/manage-preview/manage-preview.css';
export function HistoryPhotoUi(){
 const [api]=useState(()=>photoBrowser()),[enabled,setEnabled]=useState(false),[storage,setStorage]=useState(''),[items,setItems]=useState<ActivityResult[]>([]),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('운영 연결 상태 확인 중');
 const files=useRef(new Map<string,File>()),urls=useRef(new Set<string>());
 const refresh=useCallback(async()=>{const r=await api.refresh();setEnabled(r.enabled);setItems(r.activities);setStorage(r.storageOrigin??'');return r.enabled;},[api]);
 useEffect(()=>{let stopped=false;void api.refresh().then(r=>{if(stopped)return;setEnabled(r.enabled);setItems(r.activities);setStorage(r.storageOrigin??'');setNotice(r.enabled?'사진 관리 연결 확인':'운영 연결 준비 중 · 활동 조회·저장·업로드·공개가 차단됩니다.');});return()=>{stopped=true;};},[api]);
 useEffect(()=>{const pool=urls.current;return()=>{pool.forEach(u=>URL.revokeObjectURL(u));pool.clear();};},[]);
 const asset=useCallback((file:File):ActivityAsset=>{const id=crypto.randomUUID(),url=URL.createObjectURL(file);files.current.set(id,file);urls.current.add(url);return {id,url,size:file.size,name:file.name,alt:file.name};},[]);
 const release=useCallback((assets:ActivityAsset[])=>{for(const a of assets){files.current.delete(a.id);if(urls.current.delete(a.url))URL.revokeObjectURL(a.url);}},[]);
 async function run(action:()=>Promise<unknown>){setBusy(true);setNotice('서버 처리 결과 확인 중');try{await action();const ready=await refresh();setNotice(ready?'요청 처리 및 목록 재조회 완료':'요청 후 목록 확인 필요 · 자동 재시도하지 않습니다.');}catch{await refresh();setNotice('일부 처리 결과 확인 필요 · 자동 재전송하지 않습니다. 목록에서 상태를 확인해주세요.');}finally{setBusy(false);}}
 async function save(a:Activity){const selected=[a.cover,...a.additional].map(p=>files.current.get(p.id));if(selected.some(f=>!f)){setNotice('선택 사진을 다시 확인해주세요.');return;}const retained=selected as File[];setOpen(false);await run(()=>api.register({title:a.title,date:a.date,description:a.description},retained,storage));}
 function layout(a:ActivityResult,order:string[],cover:string){void run(()=>api.command('layout',{activityId:a.activityId,requestId:crypto.randomUUID(),revision:a.revision,order,cover}));}
 return <section className="activity-manager" aria-labelledby="history-photo-ui-heading"><h2 id="history-photo-ui-heading">활동 사진 관리</h2><p className="activity-notice" role="status">{notice}</p><p>JPG·PNG·WebP · 최대 10장 · 장당 4.5MiB · 합계 45MiB. 파일은 허가된 임시 Storage로 직접 전송합니다.</p>
 <div className="activity-actions"><button disabled={!enabled||busy} onClick={()=>setOpen(true)}>활동·사진 등록</button><button disabled={busy} onClick={()=>void run(async()=>{await refresh();})}>연결·목록 다시 확인</button><button disabled title="삭제 안전성 미검증">삭제 불가</button></div>
 {!enabled&&<p>운영 연결 준비 중입니다. 저장·수정·업로드·공개는 사용할 수 없습니다.</p>}
 {items.map(a=><article className="ops-panel" key={a.activityId}><h3>{a.title}</h3><button disabled title="활동 정보 수정 RPC 미연결">활동 정보 수정 준비 중</button><p>{a.date} · {a.published?'공개':'비공개'}</p><p>{a.description}</p><p>사진 {a.photos?.length??0}/10 · 대표: {a.cover??'미지정'}</p>
 {(a.order??[]).map((id,i)=><div key={id}><span>{i+1}번 · {a.cover===id?'대표 사진':id}</span><button disabled={!enabled||busy} onClick={()=>layout(a,a.order!,id)}>대표 지정</button>{[-1,1].map(step=><button key={step} disabled={!enabled||busy||i+step<0||i+step>=a.order!.length} onClick={()=>{const order=[...a.order!];[order[i],order[i+step]]=[order[i+step],order[i]];layout(a,order,a.cover!);}}>{step<0?'위로':'아래로'}</button>)}</div>)}
 {a.photos?.map(p=><p key={p.photoId}>{p.photoId} · {p.state==='complete'?'확정':'미확정/확인 필요'} {p.state==='pending'&&<button disabled={!enabled||busy||!p.requestId} onClick={()=>void run(()=>api.command('recover',{jobId:p.jobId,requestId:p.requestId}))}>서버 재확인·복구</button>}</p>)}
 <button disabled={!enabled||busy||!a.published&&(!a.photos?.length||a.photos.some(p=>p.state!=='complete'))} onClick={()=>void run(()=>api.command('visibility',{activityId:a.activityId,revision:a.revision,requestId:crypto.randomUUID(),published:!a.published}))}>{a.published?'비공개 전환':'공개 요청'}</button><p>기존 읽기 URL은 비공개 전환 후 최대 60초간 유효할 수 있습니다.</p></article>)}
 {open&&enabled&&<ActivityForm connected makeAsset={asset} release={release} close={()=>setOpen(false)} save={save}/>}
 </section>;
}
