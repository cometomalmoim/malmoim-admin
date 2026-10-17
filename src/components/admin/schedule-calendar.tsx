'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { changeSchedule, changeScheduleTag } from '@/app/actions/schedules';
import { loadScheduleData, scheduleRealtimeToken } from '@/app/actions/schedule-query';
import { koreaToday, monthGrid, weekSegments } from '@/lib/schedule-calendar';
import type { Schedule, ScheduleData, ScheduleTag } from '@/lib/schedule-types';
import type { ScheduleDialogKind } from '@/lib/schedule-search';
import { ScheduleSearchDialog } from './schedule-search-dialog';
import { ScheduleAgenda } from './schedule-agenda';
import './schedule.css';
export function ScheduleCalendar({initial,preview=false}:{initial:ScheduleData;preview?:boolean}) {
 const [data,setData]=useState(initial),[month,setMonth]=useState(koreaToday().slice(0,7)),[message,setMessage]=useState(''),[pending,start]=useTransition();
 const [selected,setSelected]=useState<Schedule|null>(null),[date,setDate]=useState(koreaToday()),[tag,setTag]=useState<ScheduleTag|null>(null),[confirmDelete,setConfirmDelete]=useState(false);
 const [formRevision,setFormRevision]=useState(0);
 const [searchKind,setSearchKind]=useState<ScheduleDialogKind|null>(null);
 const [panelOpen,setPanelOpen]=useState(false);
 const registerButton=useRef<HTMLButtonElement>(null);
 const detailHeading=useRef<HTMLHeadingElement>(null);
 const tagsDialog=useRef<HTMLDialogElement>(null);const router=useRouter();const grid=monthGrid(month);
 useEffect(()=>{
  if(!panelOpen)return;
  detailHeading.current?.focus({preventScroll:true});
  if(window.matchMedia('(max-width:740px)').matches){
   const panel=detailHeading.current?.closest('aside');
   const headerHeight=document.querySelector('.ops-header')?.getBoundingClientRect().height??0;
   if(panel)window.scrollTo({top:Math.max(0,panel.getBoundingClientRect().top+window.scrollY-headerHeight-12),behavior:'instant'});
  }
 },[panelOpen,formRevision]);

 useEffect(()=>{
  if(preview)return;
  let alive=true; const refresh=()=>{loadScheduleData().then(next=>{if(alive){if(next)setData(next);else setMessage('조회 실패: 연결을 확인해주세요.');}}).catch(()=>{if(alive)setMessage('조회 실패: 연결을 확인해주세요.');});};
  refresh();
  const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const channel=client.channel('admin-schedule',{config:{private:true}}).on('broadcast',{event:'changed'},refresh);
  const authenticate=async()=>{try{const token=await scheduleRealtimeToken();if(token&&alive){await client.realtime.setAuth(token);}}catch{if(alive)setMessage('실시간 연결을 확인해주세요. 새로고침으로 최신 일정을 볼 수 있습니다.');}};
  void authenticate().then(()=>{if(alive)channel.subscribe(status=>{if(status==='CHANNEL_ERROR')setMessage('실시간 연결 실패. 화면을 다시 열면 최신 일정을 조회합니다.');});});
  const renewal=window.setInterval(()=>void authenticate(),240000);
  const onFocus=()=>refresh(); window.addEventListener('focus',onFocus);
  return ()=>{alive=false;window.clearInterval(renewal);window.removeEventListener('focus',onFocus);void client.removeChannel(channel);};
 },[preview]);
 async function run(form:FormData,isTag=false){if(preview){setMessage('미리보기에서는 저장하지 않습니다.');return;}setMessage('');start(async()=>{try{const error=await(isTag?changeScheduleTag(form):changeSchedule(form));if(error){setMessage(error);return;}const next=await loadScheduleData();if(next)setData(next);if(!isTag){const saved=next?.schedules.find(row=>row.id===String(form.get('id')))??null;setSelected(saved);if(!saved){setPanelOpen(false);registerButton.current?.focus();}setConfirmDelete(false);setFormRevision(value=>value+1);}else setTag(null);setMessage('저장했습니다.');router.refresh();}catch{setMessage('연결을 확인하고 다시 시도해주세요.');}});}
 function open(row:Schedule|null,day=date){if(pending)return;setSelected(row);setPanelOpen(true);setDate(day);setConfirmDelete(false);setMessage('');setFormRevision(value=>value+1);}
 function move(amount:number){if(pending)return;const d=new Date(`${month}-15T00:00:00Z`);d.setUTCMonth(d.getUTCMonth()+amount);if(d.getUTCFullYear()>=1900&&d.getUTCFullYear()<=2100){const nextMonth=d.toISOString().slice(0,7);setMonth(nextMonth);chooseDate(`${nextMonth}-01`);}}
 function today(){if(pending)return;const day=koreaToday();setMonth(day.slice(0,7));chooseDate(day);}
 function closePanel(){if(pending)return;setPanelOpen(false);setSelected(null);setConfirmDelete(false);registerButton.current?.focus();}
 function chooseDate(day:string){if(pending)return;setDate(day);setSelected(null);setPanelOpen(false);setConfirmDelete(false);}
 function openAgenda(row:Schedule){const now=koreaToday();const day=row.start_date>now?row.start_date:row.end_date<now?row.end_date:now;setMonth(day.slice(0,7));open(row,day);}
 const linked=selected&&selected.source_kind!=='manual';
 return <section className="schedule"><div className={`schedule-layout ${panelOpen?'has-detail':'is-clean'}`}><div className="schedule-main-column"><div className="schedule-calendar-card"><header className="schedule-toolbar"><div><button onClick={()=>move(-1)} aria-label="이전 달">〈</button><strong aria-live="polite">{month.replace('-','년 ')}월</strong><button onClick={()=>move(1)} aria-label="다음 달">〉</button><button onClick={today}>오늘</button></div><div className="schedule-toolbar-actions"><button type="button" aria-haspopup="dialog" onClick={()=>setSearchKind('all')}>⌕ 일정 검색</button><button ref={registerButton} aria-expanded={panelOpen} aria-controls="schedule-detail-panel" onClick={()=>open(null)}>+ 일정 등록</button></div></header>
 {preview&&<p>개발 미리보기 · 저장하지 않습니다.</p>}<p role="status" aria-live="polite">{message}</p>
 <div className="schedule-calendar-body"><div className="schedule-grid"><div className="schedule-weekdays">{'일월화수목금토'.split('').map(d=><span key={d}>{d}</span>)}</div>{Array.from({length:6},(_,week)=>{const days=grid.days.slice(week*7,week*7+7),segments=weekSegments(data.schedules,days[0]);const lanes=Math.max(0,...segments.map(s=>s.lane+1));return <div className="schedule-week" key={days[0]} style={{minHeight:Math.max(80,32+Math.min(lanes,3)*23+20)}}><div className="schedule-days">{days.map(day=><button className={`${day.slice(0,7)!==month?'outside ':''}${day===koreaToday()?'today ':''}${day===date?'is-selected':''}`} key={day} onClick={()=>chooseDate(day)} aria-label={`${day} 날짜 선택`} aria-pressed={day===date}><time dateTime={day}>{Number(day.slice(-2))}</time></button>)}</div><div className="schedule-bars">{segments.filter(s=>s.lane<3).map(s=>{const t=data.tags.find(t=>t.id===s.row.tag_id);return <button key={s.row.id} className={`${s.row.start_date===s.row.end_date?'chip':'bar'} ${s.continuesBefore?'before':''} ${s.continuesAfter?'after':''}`} style={{gridColumn:`${s.column} / span ${s.span}`,gridRow:s.lane+1,background:t?.color??'#E2E8F0'}} onClick={()=>open(s.row,days[s.column-1])} aria-pressed={selected?.id===s.row.id} title={`${s.row.title} · ${s.row.start_date}~${s.row.end_date}`}><span>{s.continuesBefore?'← ':''}{s.row.title}{s.continuesAfter?' →':''}</span></button>;})}</div><div className="schedule-more">{days.map(day=>{const hidden=segments.filter(s=>s.lane>=3&&s.row.start_date<=day&&s.row.end_date>=day);return <div key={day}>{hidden.length>0&&<button onClick={()=>{const row=data.schedules.find(row=>row.start_date<=day&&row.end_date>=day);if(row)open(row,day);}} aria-label={`${day} 일정 전체 보기`}>+{hidden.length}개</button>}</div>;})}</div></div>;})}</div></div>
 <footer className="schedule-legend"><div>{data.tags.map(t=><span key={t.id}><i style={{background:t.color}}/>{t.name}</span>)}</div><button onClick={()=>{setTag(null);setMessage('');tagsDialog.current?.showModal();}}>⚙ 태그 수정</button></footer></div>
 <ScheduleAgenda onBrowse={setSearchKind} schedules={data.schedules} tags={data.tags} selectedId={selected?.id} pending={pending} onSelect={openAgenda}/></div>
 {panelOpen&&<aside id="schedule-detail-panel" className={`schedule-detail ${selected?'schedule-detail-edit':'schedule-detail-create'}`} aria-labelledby="schedule-detail-title"><div className="schedule-detail-scroll"><div className="schedule-detail-heading"><div className="schedule-detail-topline"><span className="schedule-mode-badge" role="status"><span aria-hidden="true">{selected?'✎':'＋'}</span>{selected?'기존 일정 수정':'새 일정 등록'}</span><button type="button" className="schedule-detail-close" onClick={closePanel} disabled={pending}>✕ 닫기</button></div><h2 id="schedule-detail-title" ref={detailHeading} tabIndex={-1}>{Number(date.slice(5,7))}월 {Number(date.slice(8,10))}일 <small>{['일','월','화','수','목','금','토'][new Date(date).getUTCDay()]}요일</small></h2><p>{selected?'선택한 일정의 내용을 확인하고 변경사항을 저장하세요.':'아래 양식을 작성해 새로운 일정을 추가하세요.'}</p></div>
 <div className="schedule-day-list" aria-label="선택한 날짜의 일정">{data.schedules.filter(row=>row.start_date<=date&&row.end_date>=date).map(row=>{const itemTag=data.tags.find(t=>t.id===row.tag_id);return <button key={row.id} aria-pressed={selected?.id===row.id} onClick={()=>open(row,date)}><i style={{background:itemTag?.color}}/><span>{row.title}<small>{itemTag?.name} · {row.start_date===row.end_date?'당일 일정':`${row.start_date} ~ ${row.end_date}`}</small></span><span aria-hidden="true">↗</span></button>;})}{!data.schedules.some(row=>row.start_date<=date&&row.end_date>=date)&&<p className="schedule-day-empty">등록된 일정이 없습니다.</p>}</div>

 <form className="schedule-detail-form" key={`${selected?.id??date}-${formRevision}`} action={form=>run(form)}><header><h3>{selected?'일정 상세·수정':'새 일정 등록'}</h3>{selected&&<button type="button" onClick={()=>open(null)}>+ 새 일정</button>}</header><fieldset disabled={pending}><input type="hidden" name="id" value={selected?.id??''}/><input type="hidden" name="version" value={selected?.version??0}/>
 {linked&&<p>이벤트 자동 연동 일정입니다. 제목과 기간은 <a href={`/admin/events/${data.events.find(e=>e.id===selected.event_id)?.slug??''}/edit`}>이벤트 정보에서 수정</a>합니다.</p>}
 <label>일정 제목<input name="title" required maxLength={150} defaultValue={selected?.title??''} readOnly={!!linked}/></label><div className="schedule-dates"><label>시작일<input name="start_date" type="date" required defaultValue={selected?.start_date??date} readOnly={!!linked}/></label><label>종료일 (포함)<input name="end_date" type="date" required defaultValue={selected?.end_date??date} readOnly={!!linked}/></label></div><div className="schedule-dates schedule-times"><label>시작 시간 <small>(선택)</small><input name="start_time" type="time" step="60" defaultValue={selected?.start_time?.slice(0,5)??''} readOnly={!!linked}/></label><label>끝나는 시간 <small>(선택)</small><input name="end_time" type="time" step="60" defaultValue={selected?.end_time?.slice(0,5)??''} readOnly={!!linked}/></label></div><p className="schedule-time-help">시간을 비우면 날짜만 저장합니다.</p>
 <label>태그<select name="tag_id" required defaultValue={selected?.tag_id??data.tags[0]?.id??''}>{data.tags.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>담당자<select name="assignee_id" defaultValue={selected?.assignee_id??''}><option value="">미지정</option>{data.people.map(p=><option key={p.user_id} value={p.user_id}>{p.display_name}</option>)}</select></label><label>내용/비고<textarea name="notes" rows={4} maxLength={5000} defaultValue={selected?.notes??''}/></label>
 <p role="status" aria-live="polite">{message}</p><footer><button className="schedule-primary" disabled={pending||preview||!data.tags.length}>{pending?'저장 중…':selected?'변경사항 저장':'일정 등록'}</button>{selected&&<button type="button" disabled={pending||preview} onClick={()=>setConfirmDelete(true)}>{linked?'캘린더에서 숨김':'삭제'}</button>}</footer>{confirmDelete&&<div role="alert"><p>{linked?'원본 이벤트를 유지하고 캘린더에서 숨깁니다.':'이 일정을 삭제할까요?'}</p><button type="button" disabled={pending} onClick={()=>{const f=new FormData();f.set('operation','delete');f.set('id',selected!.id);f.set('version',String(selected!.version));void run(f);}}>확인</button><button type="button" onClick={()=>setConfirmDelete(false)}>취소</button></div>}</fieldset></form></div></aside>}</div>
 {searchKind&&<ScheduleSearchDialog kind={searchKind} data={data} selectedId={selected?.id} pending={pending} onSelect={openAgenda} onDismiss={()=>setSearchKind(null)}/>}
 <dialog ref={tagsDialog} className="schedule-dialog"><header><h2>태그 관리</h2><button onClick={()=>tagsDialog.current?.close()} aria-label="닫기">×</button></header><div className="schedule-tag-list">{data.tags.map(t=><button key={t.id} onClick={()=>setTag(t)}><i style={{background:t.color}}/>{t.name}</button>)}<button onClick={()=>setTag(null)}>+ 새 태그</button></div><form key={`${tag?.id??'new'}-${tag?.version??0}`} action={form=>run(form,true)}><input type="hidden" name="id" value={tag?.id??''}/><input type="hidden" name="version" value={tag?.version??0}/><label>태그명<input name="name" required maxLength={30} defaultValue={tag?.name??''}/></label><label>색상<input name="color" type="color" defaultValue={tag?.color??'#38BDF8'}/></label><button disabled={pending}>태그 저장</button>{tag&&<><label>삭제 시 대체 태그<select name="replacement" defaultValue=""><option value="">선택해주세요</option>{data.tags.filter(t=>t.id!==tag.id&&(!tag.system_key||!t.system_key)).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><p>사용 중이거나 기본 태그라면 대체 태그가 필요합니다. 기본 태그는 새로 만든 일반 태그로 교체할 수 있습니다.</p><button name="operation" value="delete" formNoValidate disabled={pending}>태그 삭제·일정 이동</button></>}<p role="status">{message}</p></form></dialog>
 </section>;
}
