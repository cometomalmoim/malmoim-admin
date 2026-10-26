'use client';
import Image from 'next/image';
import {usePathname} from 'next/navigation';
import {checkedPhotoResponse,photoFailureMessage,PhotoRequestError,photoFetch} from '@/lib/history-simple/client-errors';
import {registerPhotos} from '@/lib/history-simple/register';
import {HistoryPhotoClassification,classificationForm} from './history-photo-classification';
import {useEffect,useState,useRef} from 'react';
import type {Album} from '@/lib/history-simple/server';
import '@/app/(public)/history/manage-preview/manage-preview.css';
import './simple-history-photo-ui.css';
export function HistoryPhotoUi({onChanged,onRegistered,mode='all',albumId}:{onChanged?:()=>void;onRegistered?:()=>void;mode?:'all'|'create'|'edit';albumId?:string}={}){
 const english=usePathname().startsWith('/en/');
 const [editing,setEditing]=useState<string|null>(mode==='edit'?albumId??null:null);
 const running=useRef(false);
 const [items,setItems]=useState<Album[]>([]),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('사진 관리 연결 확인 중');
 async function refresh(){const r=await fetch('/api/admin/history-photos',{cache:'no-store'}),d=await checkedPhotoResponse(r);if(d.enabled!==true){setEnabled(false);throw new PhotoRequestError('PERSONAL_TEST_DISABLED');}setEnabled(true);setItems(d.albums);}
 useEffect(()=>{let active=true;void fetch('/api/admin/history-photos',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!active)return;if(r.ok&&d.enabled){setItems(d.albums);setEnabled(true);setMessage('관리자 사진 관리 · 사진 등록이 완료되면 자동으로 공개됩니다.');}else setMessage('사진 관리가 비활성 상태입니다. 운영 연결 및 활성화 승인을 확인해주세요.');}).catch(()=>{if(active)setMessage('연결 확인 실패 · 업로드와 공개는 비활성입니다.');});return()=>{active=false;};},[]);
 async function command(body:unknown){const r=await photoFetch('/api/admin/history-photos',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const d=await checkedPhotoResponse(r);return d.value;}
 async function run(action:()=>Promise<void>,success?:()=>void,registration=false){
  if(running.current)return;running.current=true;setBusy(true);setMessage(english?'Processing…':'처리 중');
  try{await action();onChanged?.();setMessage(english?'Saved successfully.':'등록·저장 완료');success?.();
   if(!registration){try{await refresh();}catch{setMessage(english?'Saved, but the list could not refresh. Reopen to check.':'저장은 완료됐지만 목록을 갱신하지 못했습니다. 창을 다시 열어 확인해주세요.');}}
  }catch(error){setMessage(photoFailureMessage(error,english));}
  finally{running.current=false;setBusy(false);}
 }
 async function upload(albumId:string,files:File[]){if(!files.length||files.length>10-(items.find(a=>a.id===albumId)?.history_photo_items.length??0)||files.some(f=>f.size>4194304||!['image/png','image/jpeg','image/webp'].includes(f.type)))throw new PhotoRequestError('PHOTO_FILES_INVALID');for(const file of files){const body=new FormData();body.set('albumId',albumId);body.set('file',file);const r=await photoFetch('/api/admin/history-photos',{method:'POST',body});await checkedPhotoResponse(r);}}
 return <section className="activity-manager simple-photo-manager" aria-labelledby="simple-photo-heading"><h2 id="simple-photo-heading">활동 사진 관리</h2><p role="status" className="activity-notice">{message}</p><p>JPG·PNG·WebP · 장당 4MiB · 활동당 최대 10장. 서버에서 사진을 검사하고 WebP로 변환합니다.</p>
 {mode!=='create'&&<button disabled={busy} onClick={()=>void run(refresh)}>목록 새로 확인</button>}
 {enabled&&mode!=='edit'&&<form className="activity-form" onSubmit={e=>{e.preventDefault();const form=e.currentTarget,data=new FormData(form);void run(async()=>{await registerPhotos({title:String(data.get('title')),date:String(data.get('date')),description:String(data.get('description')),...classificationForm(data)},data.getAll('photos').filter((v):v is File=>v instanceof File&&v.size>0),{create:info=>command({op:'create',...info}),upload,publish:id=>command({op:'publish',id,published:true})});form.reset();},onRegistered,true);}}>
 <fieldset disabled={busy}><legend>활동·사진 등록</legend><HistoryPhotoClassification/><label>활동명<input name="title" required maxLength={200}/></label><label>활동일<input type="date" name="date" required/></label><label>설명<textarea name="description" maxLength={2000}/></label><label>사진<input type="file" name="photos" multiple required accept="image/png,image/jpeg,image/webp"/></label><button type="submit">{english?'Register':'등록하기'}</button></fieldset></form>}
 {mode!=='create'&&items.filter(a=>!albumId||a.id===albumId).map(a=><article className="ops-panel" key={a.id}><h3>{a.title}</h3><p>{a.date} · {a.deleting?'삭제 처리 확인 필요':a.published?'공개':'비공개'}</p><p>{a.description}</p>
 <button type="button" disabled={busy||a.deleting} onClick={()=>setEditing(editing===a.id?null:a.id)}>{english?'Edit':'수정'}</button>
 {editing===a.id&&<div>
 <form onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);void run(()=>command({op:'edit',id:a.id,title:String(data.get('title')),date:String(data.get('date')),description:String(data.get('description')),...classificationForm(data)}),()=>{setEditing(null);if(mode==='edit')onRegistered?.();});}}><fieldset disabled={!enabled||busy||a.deleting}><legend>활동 정보 수정</legend><HistoryPhotoClassification key={`${a.category}-${a.cohort}`} category={a.category} cohort={a.cohort}/><label>활동명<input name="title" defaultValue={a.title} required maxLength={200}/></label><label>활동일<input name="date" type="date" defaultValue={a.date} required/></label><label>설명<textarea name="description" defaultValue={a.description} maxLength={2000}/></label><button>정보 저장</button></fieldset></form>
 <div className="simple-photo-grid">{a.history_photo_items.sort((x,y)=>x.position-y.position).map(p=><div key={p.id}>{p.ready?<Image unoptimized src={`/api/history-photo-file?id=${p.id}&admin=1`} alt={a.title} width={180} height={140}/>:<p>업로드 미완료 · 삭제 후 다시 등록할 수 있습니다.</p>}<p>{p.ready?(p.approved?'공개 승인됨':'공개 승인 전'):'미완료'}</p><button disabled={!enabled||busy} onClick={()=>{if(window.confirm('이 사진을 삭제할까요?'))void run(()=>command({op:'delete_photo',id:p.id}));}}>사진 삭제</button></div>)}</div>
 <form onSubmit={e=>{e.preventDefault();const form=e.currentTarget,data=new FormData(form);void run(async()=>{await upload(a.id,data.getAll('photos').filter((v):v is File=>v instanceof File&&v.size>0));form.reset();});}}><fieldset disabled={!enabled||busy||a.deleting}><label>사진 추가<input name="photos" type="file" multiple required accept="image/png,image/jpeg,image/webp"/></label><button>비공개 사진 추가</button></fieldset></form>
 <button disabled={!enabled||busy||a.deleting||!a.history_photo_items.length||a.history_photo_items.some(p=>!p.ready)} onClick={()=>void run(()=>command({op:'publish',id:a.id,published:true}))}>완료 사진 공개 승인</button><button disabled={!enabled||busy||a.deleting||!a.published} onClick={()=>void run(()=>command({op:'publish',id:a.id,published:false}))}>비공개 전환</button><button disabled={!enabled||busy} onClick={()=>{if(window.confirm('활동과 사진을 모두 삭제할까요?'))void run(()=>command({op:'delete_album',id:a.id}));}}>활동 전체 삭제</button>
 </div>}
 </article>)}
 </section>;
}
