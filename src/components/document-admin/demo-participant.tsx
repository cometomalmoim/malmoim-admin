'use client';
import {useEffect,useRef,useState} from 'react';
import {SignaturePad} from '@/components/pdf-fields/signature-pad';
import {PdfCanvas} from '@/components/pdf-fields/pdf-canvas';
import {openLocalPdf,type LocalPdf} from './local-pdf';
import {consentItems,requireSigningReady,koreaDate,type ConsentAnswers,type Ink} from '@/lib/pdf-signing';
import styles from './demo-participant.module.css';
export function DemoParticipant({token}:{token:string}){
 const [code,setCode]=useState(''),[name,setName]=useState(''),[phase,setPhase]=useState('waiting');
 const [source,setSource]=useState<LocalPdf|null>(null),[pdfUrl,setPdfUrl]=useState('');
 const [answers,setAnswers]=useState<ConsentAnswers>({media:null,rules:false,consequences:false,refund:false});
 const [ink,setInk]=useState<Ink>([]),[read,setRead]=useState(false),[review,setReview]=useState(false),[confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[reviewDate,setReviewDate]=useState('');
 const session=useRef(''),submission=useRef(''),resource=useRef<LocalPdf|null>(null),objectUrl=useRef('');
 useEffect(()=>{session.current=sessionStorage.getItem(`esign-demo-${token}`)??'';return()=>{void resource.current?.destroy();if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);};},[token]);
 async function api(operation:string,extra:Record<string,unknown>={}){
  const response=await fetch(`/preview/sign/${token}/api`,{method:'POST',headers:{'Content-Type':'application/json','x-esign-demo-session':session.current},body:JSON.stringify({operation,...extra})});
  if(!response.ok){const data=await response.json();throw new Error(data.code);}
  return response;
 }
 async function loadPdf(){const response=await api('pdf');if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);objectUrl.current=URL.createObjectURL(await response.blob());setPdfUrl(objectUrl.current);}
 async function loadDocument(){const response=await api('document');const file=new File([await response.blob()],'malmoim-development-only.pdf',{type:'application/pdf'});const next=await openLocalPdf(file);void resource.current?.destroy();resource.current=next;setSource(next);setPhase('signing');}
 async function enter(resume=false){if(busy)return;setBusy(true);setNotice('');try{
  const data=await (await api(resume?'status':'verify',resume?{}:{code})).json();
  if(data.session){session.current=data.session;sessionStorage.setItem(`esign-demo-${token}`,data.session);}
  setName(data.name);setPhase(data.phase);if(data.phase==='completed')await loadPdf();else await loadDocument();
 }catch(e){setNotice((e as Error).message);}finally{setBusy(false);}}
 function prepare(){try{if(!source)throw new Error('테스트 PDF를 먼저 여세요.');const fields=['name','date','signature'].map((kind,i)=>({id:String(i),kind:kind as 'name'|'date'|'signature',pageNumber:1,rect:{x:0,y:0,width:1,height:1}}));requireSigningReady(answers,ink,fields,read);setReviewDate(koreaDate(new Date().toISOString()));setReview(true);setConfirmed(false);setNotice('');}catch(e){setNotice((e as Error).message);}}
 async function submit(){if(busy||!confirmed)return;setBusy(true);setNotice('');try{submission.current ||= crypto.randomUUID();const data=await(await api('submit',{name,answers,ink,read,confirmed,idempotencyKey:submission.current})).json();setPhase(data.phase);setNotice('테스트 서명을 서버 메모리에 접수했습니다. 실제 법적 인증·영구 저장이 아닙니다.');await loadPdf();}catch(e){setNotice((e as Error).message);}finally{setBusy(false);}}
 return <main className={styles.page}><header><p>MALMOIM · DEVELOPMENT DEMO</p><h1>참가자 전자서명 시연</h1></header>
 <aside className={styles.notice}>개발 전용 테스트 문서입니다. 실제 말모임 활동 동의서 원본이 아닙니다. 실제 개인정보·실제 서명 입력 금지. 가상 확인 코드는 실제 본인 인증이나 OTP가 아닙니다. 요청·PDF는 서버 메모리에만 유지되며 재시작 시 사라집니다.</aside>
 <p role="status" aria-live="polite">{notice}</p>
 {phase==='waiting'?<section><h2>1. 가상 본인 확인</h2><p>관리자에게 받은 개발 시연용 확인 코드를 입력하세요. 다른 요청의 코드로는 열 수 없습니다.</p><label>개발 시연용 확인 코드<input value={code} onChange={e=>setCode(e.target.value)} autoComplete="off"/></label><button disabled={busy||!code} onClick={()=>void enter()}>가상 확인 후 테스트 문서 열기</button><button disabled={busy} onClick={()=>void enter(true)}>이 탭의 인증·서명 상태 다시 조회</button></section>:phase==='completed'?<section><h2>테스트 서명 완료</h2><p>{name} · 완료 PDF는 서버 메모리에 있습니다. 관리자도 서버 요청 목록을 재조회해 확인할 수 있습니다.</p>{pdfUrl&&<><a href={pdfUrl} download="malmoim-development-signed.pdf">완료 테스트 PDF 다운로드</a><a href={pdfUrl} target="_blank" rel="noopener noreferrer">완료 PDF 별도 미리보기</a><iframe className={styles.completed} src={pdfUrl} title="완료 테스트 PDF"/></>}</section>:<>
 <section><h2>2. 테스트 원문 확인</h2><p>가상 신청자: {name}. 실제 개인정보 수집 동의서로 사용하지 마세요.</p>{source?.pages.map(page=><div className={styles.paper} key={page.pageNumber} style={{aspectRatio:`${page.width}/${page.height}`}}><PdfCanvas pdf={source.pdf} page={page} scale={Math.min(1,680/page.width)}/></div>)}<label className={styles.check}><input type="checkbox" checked={read} disabled={review} onChange={e=>setRead(e.target.checked)}/>테스트 PDF의 모든 내용을 확인했습니다.</label></section>
 {!review?<><section><h2>3. 항목별 응답</h2>{consentItems.map(item=><fieldset key={item.id}><legend>{item.title} ({item.optional?'선택':'필수'})</legend><p>{item.text}</p>{item.id==='media'?<><label className={styles.check}><input type="radio" name="media" checked={answers.media===true} onChange={()=>setAnswers(a=>({...a,media:true}))}/>동의합니다</label><label className={styles.check}><input type="radio" name="media" checked={answers.media===false} onChange={()=>setAnswers(a=>({...a,media:false}))}/>동의하지 않습니다</label></>:<label className={styles.check}><input type="checkbox" checked={answers[item.id]} onChange={e=>setAnswers(a=>({...a,[item.id]:e.target.checked}))}/>이 항목을 확인했습니다</label>}</fieldset>)}</section><section><h2>4. 이름·날짜·서명</h2><label>가상 신청자 이름<input readOnly value={name}/></label><p>이름은 요청에 고정되며 날짜는 서버 접수 시각 기준 한국 날짜로 입력됩니다.</p><SignaturePad value={ink} onChange={setInk}/><button onClick={prepare}>제출 전 최종 확인</button></section></>:<section><h2>5. 제출 전 최종 확인</h2><p>이름: {name} / 예상 날짜: {reviewDate} (최종 PDF는 서버 접수 시각 기준)</p><ul>{consentItems.map(item=><li key={item.id}>{item.title}: {item.id==='media'?(answers.media?'동의':'동의하지 않음'):'확인함'}</li>)}</ul><p>같은 서명이 테스트 문서의 두 서명란에 적용됩니다.</p><svg className={styles.reviewInk} viewBox="0 0 900 300" aria-label="최종 확인 서명">{ink.map((stroke,i)=><polyline key={i} points={stroke.map(p=>`${p.x*900},${p.y*300}`).join(' ')} fill="none" stroke="#163b32" strokeWidth="5"/>)}</svg><label className={styles.check}><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>이름·날짜·동의 응답·서명을 최종 확인했습니다.</label><button disabled={busy} onClick={()=>{setReview(false);setConfirmed(false);submission.current='';}}>서명·응답 다시 수정</button><button disabled={!confirmed||busy} onClick={()=>void submit()}>{busy?'서버 처리 중…':'테스트 서명 제출'}</button></section>}
 </>}
 </main>;
}
