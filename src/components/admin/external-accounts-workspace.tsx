'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveExternalAccount, revealExternalAccount, getExternalAccountLogs } from '@/app/actions/external-accounts';
import { accountCategories, renewalDays, type ExternalAccount, type AccountMember, type AccountLog } from '@/lib/external-account-types';
import { AccountServiceIcon } from './account-service-icon';
import { AccountRegistrationButton } from './account-registration-button';
import './external-accounts.css';

export function ExternalAccountsWorkspace({accounts,members,logs,master,today}:{accounts:ExternalAccount[];members:AccountMember[];logs:AccountLog[];master:boolean;today:string}) {
  const [registering,setRegistering]=useState(false);
  const [selected,setSelected]=useState(accounts[0]?.id??'');
  const [search,setSearch]=useState(''); const [category,setCategory]=useState('');
  const [message,setMessage]=useState(''); const [pending,start]=useTransition();
  const router=useRouter();
  const account=accounts.find(a=>a.id===selected);
  const filtered=accounts.filter(a=>(!category||a.category===category)&&`${a.service_name} ${a.login_id} ${a.department}`.toLowerCase().includes(search.toLowerCase()));
  function select(id:string){setSelected(id);setMessage('');}
  return <><div className="ea-toolbar"><span className="ops-tag">{'초기 운영 · 모든 관리자 조회·수정'}</span><span>{accounts.length}개 계정</span><AccountRegistrationButton allowed onClick={()=>{setMessage('');setRegistering(true);}}/></div><p role="status">{message}</p><div className="ea-split grid items-start gap-5"><aside className="ops-panel ea-list" aria-label="외부 계정 목록"><label>실시간 검색<input type="search" placeholder="서비스명, ID, 부서 검색" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="ea-filters" aria-label="카테고리 필터">{[['','전체'],...Object.entries(accountCategories)].map(([key,name])=><button key={key} aria-pressed={category===key} onClick={()=>setCategory(key)}>{name}</button>)}</div><p className="ops-muted">검색 결과 {filtered.length}개</p>{filtered.map(a=>{const days=renewalDays(a.next_billing_date,today);return <button className="ea-row" key={a.id} aria-pressed={selected===a.id} onClick={()=>select(a.id)}><AccountServiceIcon url={a.service_url} category={a.category}/><span><strong>{a.service_name}</strong><small>{a.login_id}</small><span className="ops-tag">{accountCategories[a.category]}</span><small>◉ {members.find(m=>m.user_id===a.primary_manager)?.display_name??'담당자 미지정'}</small>{a.billing_cycle!=='none'&&days!==null&&days<=a.renewal_notice_days&&<span className="ea-warning">{days<0?`${-days}일 지남`:days===0?'오늘 결제':`결제 D-${days}`}</span>}</span></button>})}{!filtered.length&&<p className="ops-empty">조건에 맞는 계정이 없습니다.</p>}</aside><section className="ops-panel ea-detail" aria-label="계정 상세">{account?<AccountDetail key={`${selected}:${account?.updated_at??'new'}`} account={account} members={members} logs={logs.filter(l=>l.account_id===selected)} master={master} pending={pending} onSave={(form,remove)=>start(async()=>{const result=await saveExternalAccount(form,remove);setMessage(result.message);if(result.success){setSelected(remove?'':result.id??'');router.refresh();}})}/>:<p className="ops-empty">{"계정을 선택하거나 새 계정을 등록해주세요."}</p>}</section></div>{registering&&<NewAccountDialog members={members} pending={pending} message={message} onClose={()=>setRegistering(false)} onSave={form=>start(async()=>{const result=await saveExternalAccount(form);setMessage(result.message);if(result.success){setSelected(result.id??"");setSearch("");setCategory("");setRegistering(false);router.refresh();}})}/>}</>;
}
function NewAccountDialog({members,pending,message,onClose,onSave}:{members:AccountMember[];pending:boolean;message:string;onClose:()=>void;onSave:(form:FormData)=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    dialog.current?.showModal();
    return ()=>{if(previous?.isConnected)previous.focus();};
  },[]);
  return <dialog ref={dialog} className="ea-registration-dialog" aria-label="외부 서비스 계정 등록" aria-busy={pending} onClose={onClose} onCancel={e=>{if(pending)e.preventDefault();}}>
    <div className="ea-registration-close"><button type="button" disabled={pending} onClick={onClose} aria-label="등록 패널 닫기">닫기 ×</button></div>
    <div className="ea-split ea-registration-form">
      <AccountDetail members={members} logs={[]} master pending={pending} onSave={onSave}/>
      <p role="status">{message}</p>
    </div>
  </dialog>;
}
function AccountDetail({account,members,logs,master,pending,onSave}:{account?:ExternalAccount;members:AccountMember[];logs:AccountLog[];master:boolean;pending:boolean;onSave:(form:FormData,remove:boolean)=>void}) {
  const [secret,setSecret]=useState('');
  const [notice,setNotice]=useState(''); const [busy,start]=useTransition(); const [confirmDelete,setConfirmDelete]=useState(false);
  const router=useRouter();
  const [audit,setAudit]=useState(logs);
  useEffect(()=>{if(!account)return;let cancelled=false;getExternalAccountLogs(account.id).then(result=>{if(cancelled)return;if(result.logs)setAudit(result.logs);else setNotice(result.message??"기록 조회 실패");}).catch(()=>{if(!cancelled)setNotice("기록을 불러오지 못했습니다.");});return()=>{cancelled=true;};},[account]);
  useEffect(()=>{if(!secret)return;const timer=setTimeout(()=>setSecret(''),15000);const clear=()=>setSecret('');window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);return()=>{clearTimeout(timer);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear);};},[secret]);
  async function copy(value:string){try{await navigator.clipboard.writeText(value);setNotice('클립보드에 복사했습니다.');}catch{setNotice('브라우저가 복사를 차단했습니다. 새 코드로 보기 기능을 사용해주세요.');}}
  function accessPassword(action:'view'|'copy') {
    if(!account)return;
    start(async()=>{
      setSecret('');
      const result=await revealExternalAccount(account.id,action);
      setNotice(result.message);
      if(result.password){if(action==='copy')await copy(result.password);else setSecret(result.password);router.refresh();}
    });
  }
  if(!account&&!master)return <p className="ops-empty">열람 권한이 있는 계정이 없습니다.</p>;
  return <><div className="ea-toolbar"><h2 className="ea-service-heading">{account&&<AccountServiceIcon url={account.service_url} category={account.category} size={32}/>} {account?.service_name??'외부 서비스 계정 등록'}</h2>{account&&<a href={account.service_url} target="_blank" rel="noopener noreferrer" className="ops-link">서비스 바로가기 ↗</a>}</div>{account&&<section className="ea-secret" aria-label="로그인 정보"><div><span>로그인 ID</span><strong>{account.login_id}</strong><button onClick={()=>void copy(account.login_id)}>ID 복사</button></div><div><span>비밀번호</span><output>{secret||'••••••••'}</output><button disabled={busy} onClick={()=>accessPassword('view')}>보기</button><button disabled={busy} onClick={()=>accessPassword('copy')}>복사하기</button></div></section>}<p role="status">{notice}</p><form onSubmit={e=>{e.preventDefault();onSave(new FormData(e.currentTarget),false);}}><input type="hidden" name="id" value={account?.id??''}/><input type="hidden" name="updated_at" value={account?.updated_at??''}/><fieldset disabled={pending} className="ea-fields"><legend>계정 정보</legend>{[['service_name','서비스명'],['service_url','서비스 접속 URL'],['login_id','계정 ID / 이메일'],['department','공유 부서']].map(([key,label])=><label key={key}>{label}<input name={key} type={key==='service_url'?'url':'text'} autoFocus={!account&&key==='service_name'} required={key!=='department'} maxLength={key==='service_url'?2000:key==='service_name'?120:key==='login_id'?254:100} defaultValue={String(account?.[key as keyof ExternalAccount]??'')}/></label>)}<label>카테고리<select name="category" defaultValue={account?.category??'other'}>{Object.entries(accountCategories).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>{[['primary_manager','1차 담당자'],['sub_manager','2차 백업 담당자']].map(([key,label])=><label key={key}>{label}<select name={key} defaultValue={String(account?.[key as keyof ExternalAccount]??'')}><option value="">미지정</option>{members.map(m=><option key={m.user_id} value={m.user_id}>{m.display_name} · {m.department||'부서 없음'}</option>)}</select></label>)}<label>비밀번호 {account&&'(변경할 때만 입력)'}<input name="password" type="password" required={!account} maxLength={4096} autoComplete="new-password"/></label><label>결제 주기<select name="billing_cycle" defaultValue={account?.billing_cycle??'monthly'}><option value="monthly">월</option><option value="yearly">연</option><option value="none">구독 없음</option></select></label><label>결제 수단/카드 별칭<input name="payment_method" maxLength={120} defaultValue={account?.payment_method??''} placeholder="법인카드 끝 4자리 · 전체 카드번호 입력 금지"/></label><label>결제 금액<input name="amount" type="number" min="0" step="0.01" max="999999999999.99" required defaultValue={account?.amount??0}/></label><label>통화<select name="currency" defaultValue={account?.currency??'KRW'}>{['KRW','USD','EUR','JPY'].map(c=><option key={c}>{c}</option>)}</select></label><label>다음 결제일<input type="date" name="next_billing_date" defaultValue={account?.next_billing_date??''}/></label><label>갱신 알림 (일 전)<input type="number" min="0" max="90" required name="renewal_notice_days" defaultValue={account?.renewal_notice_days??7}/></label><label className="ea-full">메모<textarea name="notes" maxLength={5000} defaultValue={account?.notes??''}/></label></fieldset><div className="ea-toolbar"><button className="ea-primary" disabled={pending}>{pending?"저장 중…":account?"계정 저장":"새 계정 등록"}</button>{master&&account&&!confirmDelete&&<button type="button" disabled={pending} onClick={()=>setConfirmDelete(true)}>계정 삭제</button>}{master&&account&&confirmDelete&&<><span>이 계정을 삭제할까요? 감사 기록은 보존됩니다.</span><button type="button" disabled={pending} onClick={e=>onSave(new FormData(e.currentTarget.form!),true)}>삭제 확정</button><button type="button" onClick={()=>setConfirmDelete(false)}>취소</button></>}</div></form>{account&&<><LogSection title="최근 열람 기록" logs={audit.filter(l=>['view','copy'].includes(l.action))}/><LogSection title="변경 히스토리" logs={audit.filter(l=>!['view','copy'].includes(l.action))}/><small>이 계정의 최근 100건입니다. 전체 기록은 DB에 보존됩니다.</small></>}</>;
}
function LogSection({title,logs}:{title:string;logs:AccountLog[]}) {
  return <details className="ea-audit"><summary>{title} ({logs.length})</summary>{!logs.length&&<p>기록이 없습니다.</p>}<ol>{logs.map(l=><li key={l.id}><strong>{l.actor_name}</strong> · {{view:'비밀번호 보기',copy:'비밀번호 복사',create:'계정 생성',update:'계정 변경',delete:'계정 삭제'}[l.action]}<br/><time dateTime={l.created_at}>{new Date(l.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</time>{Object.entries(l.changes).map(([field,value])=><p key={field}>{field==='password'?'비밀번호 변경':`${field}: ${JSON.stringify(value)}`}</p>)}</li>)}</ol></details>;
}
