'use client';
import {StoredLayoutEditor} from './stored-layout-editor';
import {layoutCommand,savedLayoutMatches} from '@/lib/history-activities/photo-layout';
import {localFinalPhotos} from '@/lib/history-activities/development-final-photos';
import {useState,useRef,useEffect,useCallback} from 'react';
import {ActivityForm} from '../(public)/history/manage-preview/activity-form';
import {HistoryGallery} from '../(public)/history/history-content';
import type {HistoryPhoto} from '../(public)/history/history-data';
import type {Activity,ActivityAsset} from '../(public)/history/manage-preview/activity-types';
import type {ActivityStorageCommand,StoredActivity} from '@/lib/history-activities/activity-storage';
const endpoint='/photo-management-preview/storage';
async function post(body:unknown){const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const result=await r.json();if(!r.ok)throw Error('저장 결과를 확인하지 못했습니다. 자동 재전송하지 않습니다.');return result;}
export function IndependentStoragePanel(){
 const [activities,setActivities]=useState<StoredActivity[]>([]);
 const [admin,setAdmin]=useState(false),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('독립 테스트 저장소 확인 중'),[photos,setPhotos]=useState<HistoryPhoto[]>([]);
 const files=useRef(new Map<string,File>()),urls=useRef(new Set<string>());
 async function refresh(){try{const r=await fetch(endpoint,{cache:'no-store'});if(!r.ok){setAdmin(false);setNotice('독립 테스트 관리자 로그인 필요 · 모의 화면은 아래에서 계속 사용 가능합니다.');return;}const data=await r.json();
 setAdmin(true);setActivities(data.activities);
 const displayed=await localFinalPhotos(data.photos,url=>urls.current.add(url));
 setPhotos(displayed);setAdmin(true);setNotice('독립 테스트 저장소 연결 · 3004 개발 /history만 공개 연동 · 삭제 차단');return data.activities as StoredActivity[];}catch{setNotice('독립 저장소 미연결 · 기존 모의 화면을 사용해주세요.');}}
 useEffect(()=>{const timer=setTimeout(()=>{void refresh();},0);const pool=urls.current;return()=>{clearTimeout(timer);pool.forEach(url=>URL.revokeObjectURL(url));};},[]);
 const asset=useCallback((file:File):ActivityAsset=>{const id=crypto.randomUUID(),url=URL.createObjectURL(file);files.current.set(id,file);urls.current.add(url);return {id,url,name:file.name,alt:file.name,size:file.size};},[]);
 const release=useCallback((assets:ActivityAsset[])=>{for(const a of assets){files.current.delete(a.id);if(urls.current.delete(a.url))URL.revokeObjectURL(a.url);}},[]);
 async function command(c:ActivityStorageCommand):Promise<StoredActivity>{const r=await post({op:'command',command:c});return r.activity;}
 async function save(a:Activity){
 setBusy(true);setEditing(false);const assets=[a.cover,...a.additional];
 try{
 const selected=assets.map(p=>files.current.get(p.id));if(selected.some(f=>!f))throw Error('선택 파일을 다시 확인해주세요.');
 let record=await command({operation:'create',requestId:crypto.randomUUID(),title:a.title,date:a.date,description:a.description});
 record=await command({operation:'reserve',requestId:crypto.randomUUID(),activityId:record.id,revision:record.revision,files:assets.map((p,i)=>({clientId:p.id,size:p.size,mime:selected[i]!.type}))});
 for(let i=0;i<record.order.length;i++){
 const photoId=record.order[i];setNotice(`${i+1}/${record.order.length} 임시 업로드 및 서버 확정 검증 중`);
 const permit=await post({op:'permit',photoId});
 // File body goes ONLY to pinned independent Storage; never through Next.js.
 const url=new URL(permit.signedUrl);if(url.origin!=='http://127.0.0.1:58421'||!url.pathname.startsWith('/storage/v1/object/upload/sign/history-activity-photos/'))throw Error('허용되지 않은 업로드 대상');
 const upload=await fetch(url,{method:'PUT',headers:{'content-type':selected[i]!.type,'x-upsert':'false'},body:selected[i]!});if(!upload.ok)throw Error('전송 결과 확인 필요 · 자동 재시도 차단');
 record=await command({operation:'finalize',requestId:crypto.randomUUID(),activityId:record.id,revision:record.revision,photoId});
 }
 await refresh();setNotice('독립 Supabase 확정 저장 완료 · 서버에서 원본과 확정 파일 해시 일치를 확인했습니다.');
 }catch(e){setNotice(e instanceof Error?e.message:'확인 필요 · 기록 보존');await refresh();setNotice('일부 저장 결과 확인 필요 · 자동 재시도하지 않습니다. 확정된 사진만 표시합니다.');}
 finally{setBusy(false);}
 }
 async function saveLayout(a:StoredActivity,order:string[],coverId:string){setBusy(true);setNotice('대표·순서 저장 결과 확인 중');try{
 const commandInput=layoutCommand(a,order,coverId,crypto.randomUUID());const stored=await command(commandInput);
 if(!savedLayoutMatches(stored,a,order,coverId))throw Error('결과 불일치');
 const fresh=await refresh();if(!savedLayoutMatches(fresh?.find(x=>x.id===a.id),a,order,coverId))throw Error('재조회 불일치');
 setNotice('대표 사진·슬라이드 순서 저장 및 DB 재조회 확인 완료');
 }catch{await refresh();setNotice('저장 결과 확인 필요 · 다른 변경 또는 권한·확정 상태를 확인해주세요. 자동 덮어쓰기나 재시도는 하지 않습니다.');}finally{setBusy(false);}}
 async function visibility(a:StoredActivity){setBusy(true);setNotice('공개 조건 확인 중');try{await command({operation:'visibility',requestId:crypto.randomUUID(),activityId:a.id,revision:a.revision,published:!a.published});await refresh();setNotice(a.published?'비공개 저장 · 새 읽기 URL 발급 중단. 기존 URL은 최대 60초 유효할 수 있습니다.':'개발 /history 공개 완료 · 확정 파일 내용과 해시를 확인했습니다.');}catch{await refresh();setNotice('공개 변경 차단 · 관리자·확정 상태·파일 내용 또는 최신 버전을 확인하지 못했습니다.');}finally{setBusy(false);}}
 return <section aria-label="독립 테스트 실제 저장" data-independent-storage><h2>독립 테스트 실제 저장 · 58421 전용</h2><p>로컬 개발 전용입니다. 운영 DB·기존 테스트 데이터에는 연결하지 않습니다. 최대 10장 · 장당 4.5MB · 합계 45MB</p>
 {!admin&&<form method="post" onSubmit={async e=>{e.preventDefault();const data=new FormData(e.currentTarget);setBusy(true);try{await post({op:'login',email:data.get('email'),password:data.get('password')});await refresh();}catch{setNotice('독립 테스트 관리자 인증 실패');}finally{setBusy(false);}}}><label>테스트 이메일<input name="email" type="email" autoComplete="off" required/></label><label>테스트 비밀번호<input name="password" type="password" autoComplete="off" required/></label><button disabled={busy}>독립 관리자 로그인</button></form>}
 {admin&&<form action="/photo-management-preview/admin-session" method="post"><button>관리자 사진 관리 페이지 열기</button></form>}
 {admin&&<button className="activity-primary" disabled={busy} onClick={()=>setEditing(true)}>독립 환경에 실제 사진 등록</button>}
 {admin&&activities.map(a=><div key={a.id} data-visibility-activity={a.id}><span>{a.title} · {a.published?'개발 공개':'비공개'}</span><button disabled={busy} onClick={()=>{void visibility(a);}}>{a.published?'비공개로 전환':'개발 히스토리에 공개'}</button><StoredLayoutEditor key={a.id+':'+a.revision} activity={a} preview={photos.find(p=>p.id===a.id)} busy={busy} save={(order,cover)=>saveLayout(a,order,cover)}/></div>)}
 <p role="status" data-independent-status>{notice}</p><HistoryGallery photos={photos}/>
 {editing&&<ActivityForm makeAsset={asset} release={release} close={()=>setEditing(false)} save={a=>{void save(a);}}/>}
 </section>;
}
