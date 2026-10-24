'use client';
import {useEffect,useMemo,useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {saveExternalAccount,revealExternalAccount,getExternalAccountLogs} from '@/app/actions/external-accounts';
import type {ExternalAccount,AccountMember,AccountLog} from '@/lib/external-account-types';
import {filterExternalAccounts,paymentBadge} from '@/lib/external-account-list';
import {AccountServiceIcon} from './account-service-icon';
import {AccountRegistrationButton} from './account-registration-button';
import './external-accounts.css';

type SaveAccount=(form:FormData,remove:boolean)=>Promise<boolean>;
export function ExternalAccountsWorkspace({accounts,members,logs,today}:{accounts:ExternalAccount[];members:AccountMember[];logs:AccountLog[];today:string}) {
  const [registering,setRegistering]=useState(false);
  const [selected,setSelected]=useState('');
  const [search,setSearch]=useState('');
  const [message,setMessage]=useState('');
  const [toast,setToast]=useState('');
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),5000);return()=>clearTimeout(timer);},[toast]);
  const [pending,setPending]=useState(false);
  const selectedButton=useRef<HTMLButtonElement|null>(null);
  const router=useRouter();
  const account=accounts.find(item=>item.id===selected);
  const selectedLogs=useMemo(()=>logs.filter(log=>log.account_id===selected),[logs,selected]);
  const filtered=filterExternalAccounts(accounts,members,search);
  function closeDetail(){setSelected('');setMessage('');if(selectedButton.current?.isConnected)selectedButton.current.focus();}
  async function save(form:FormData,remove:boolean) {
    if(pending)return false;
    setPending(true);
    try {
      const result=await saveExternalAccount(form,remove);
      setMessage(result.message);
      if(result.success) {
        if(remove){setSelected('');setToast('계정을 삭제했습니다.');}
        else if(!form.get('id')){setRegistering(false);setSelected('');setSearch('');setMessage('계정을 등록했습니다. 목록에서 선택해 확인하세요.');}
        router.refresh();
      }
      return result.success;
    } catch {setMessage('요청을 완료하지 못했습니다. 입력 내용은 유지됩니다. 다시 시도해주세요.');return false;}
    finally {setPending(false);}
  }
  return <>
    <div className="ea-toolbar"><span className="ops-tag">초기 운영 · 모든 관리자 조회·수정·삭제</span><span>{accounts.length}개 계정</span><AccountRegistrationButton allowed busy={pending} onClick={()=>{setMessage('');setRegistering(true);}}/></div>
    <p role="status">{message}</p>
    {toast&&<div className="ea-toast" role="status">{toast}</div>}
    <div className="ea-split grid items-start gap-5">
      <aside className="ops-panel ea-list" aria-label="외부 계정 목록">
        <label>실시간 검색<input type="search" placeholder="서비스명, ID, 담당자 검색" value={search} onChange={event=>setSearch(event.target.value)}/></label>
        <p className="ops-muted">검색 결과 {filtered.length}개</p>
        {filtered.map(item=>{
          const badge=paymentBadge(item,today);
          const manager=members.find(member=>member.user_id===(item.manager_person_id||item.primary_manager))?.display_name??'담당자 미지정';
          return <button type="button" className="ea-row" key={item.id} disabled={pending} aria-pressed={selected===item.id} onClick={event=>{selectedButton.current=event.currentTarget;setSelected(item.id);setMessage('');}}>
            <AccountServiceIcon url={item.service_url}/><span className="ea-row-content"><strong>{item.service_name}</strong><small>담당자 · {manager}</small></span>{badge&&<span className={badge.warning?'ea-warning':'ea-payment-badge'}>{badge.label}</span>}
          </button>;
        })}
        {!filtered.length&&<p className="ops-empty">조건에 맞는 계정이 없습니다.</p>}
      </aside>
      <section className="ops-panel ea-detail" aria-label="계정 상세">
        {account?<AccountDetail key={account.id} account={account} members={members} logs={selectedLogs} pending={pending} onSave={save} onClose={closeDetail}/>:<p className="ops-empty">목록에서 계정을 선택하면 상세 정보가 표시됩니다.</p>}
      </section>
    </div>
    {registering&&<NewAccountDialog members={members} pending={pending} message={message} onClose={()=>setRegistering(false)} onSave={save}/>}
  </>;
}
function NewAccountDialog({members,pending,message,onClose,onSave}:{members:AccountMember[];pending:boolean;message:string;onClose:()=>void;onSave:SaveAccount}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;dialog.current?.showModal();return()=>{if(previous?.isConnected)previous.focus();};},[]);
  return <dialog ref={dialog} className="ea-registration-dialog" aria-label="외부 서비스 계정 등록" aria-busy={pending} onClose={onClose} onCancel={event=>{if(pending)event.preventDefault();}}>
    <div className="ea-registration-close"><button type="button" disabled={pending} onClick={onClose} aria-label="등록 패널 닫기">닫기 ×</button></div>
    <div className="ea-split ea-registration-form"><AccountDetail members={members} logs={[]} pending={pending} onSave={onSave}/><p role="status">{message}</p></div>
  </dialog>;
}
export function AccountDetail({account,members,logs,pending,onSave,onClose}:{account?:ExternalAccount;members:AccountMember[];logs:AccountLog[];pending:boolean;onSave:SaveAccount;onClose?:()=>void}) {
  const [draft,setDraft]=useState<ExternalAccount|null>(null);
  const [resetVersion,setResetVersion]=useState(0);
  const [secret,setSecret]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,start]=useTransition();
  const [audit,setAudit]=useState(logs);
  const form=useRef<HTMLFormElement>(null);
  const router=useRouter();
  const editing=!account||draft!==null;
  const record=draft??account;
  useEffect(()=>{if(!account)return;let cancelled=false;getExternalAccountLogs(account.id).then(result=>{if(cancelled)return;if(result.logs)setAudit(result.logs);else setNotice(result.message??'기록 조회 실패');}).catch(()=>{if(!cancelled)setNotice('기록을 불러오지 못했습니다.');});return()=>{cancelled=true;};},[account]);
  useEffect(()=>{if(!secret)return;const timer=setTimeout(()=>setSecret(''),15000);const clear=()=>setSecret('');window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);return()=>{clearTimeout(timer);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear);};},[secret]);
  useEffect(()=>{if(editing)form.current?.querySelector<HTMLInputElement>('[name="service_name"]')?.focus();},[editing]);
  function beginEdit(){if(account){setDraft({...account});setResetVersion(value=>value+1);setSecret('');setNotice('');}}
  function cancelEdit(){setDraft(null);setResetVersion(value=>value+1);setSecret('');setNotice('');}
  async function copy(value:string){try{await navigator.clipboard.writeText(value);setNotice('클립보드에 복사했습니다.');}catch{setNotice('브라우저가 복사를 차단했습니다. 보기로 확인해주세요.');}}
  function accessPassword(action:'view'|'copy') {
    if(!account)return;
    start(async()=>{
      setSecret('');
      try {const result=await revealExternalAccount(account.id,action);setNotice(result.message);if(result.password){if(action==='copy')await copy(result.password);else setSecret(result.password);router.refresh();}}
      catch {setNotice('비밀번호 요청을 완료하지 못했습니다. 다시 시도해주세요.');}
    });
  }
  return <>
    <div className="ea-toolbar">
      <h2 className="ea-service-heading">{account&&<AccountServiceIcon url={account.service_url} size={32}/>} {account?.service_name??'외부 서비스 계정 등록'}</h2>
      {account&&<><a href={account.service_url} target="_blank" rel="noopener noreferrer" className="ops-link">서비스 바로가기 ↗</a><button type="button" disabled={pending} onClick={onClose} aria-label="계정 상세 닫기">닫기 ×</button></>}
    </div>
    {account&&<>
      <span className="ops-tag">{editing?'수정 모드':'조회 모드'}</span>
      <section className="ea-secret" aria-label="로그인 정보">
        <div><span>로그인 ID</span><strong>{account.login_id}</strong><button type="button" onClick={()=>void copy(account.login_id)}>ID 복사</button></div>
        <div><span>비밀번호</span><output>{secret||'••••••••'}</output><button type="button" disabled={busy||pending} onClick={()=>secret?setSecret(''):accessPassword('view')}>{secret?'숨기기':'보기'}</button><button type="button" disabled={busy||pending} onClick={()=>accessPassword('copy')}>복사하기</button></div>
      </section>
    </>}
    <p role="status">{notice}</p>
    <form ref={form} key={`${record?.updated_at??'new'}:${resetVersion}`} onSubmit={async event=>{
      event.preventDefault();if(!editing||pending)return;
      const values=new FormData(event.currentTarget);
      if(await onSave(values,false)){setDraft(null);setResetVersion(value=>value+1);setSecret('');}
    }}>
      <input type="hidden" name="id" value={record?.id??''}/><input type="hidden" name="updated_at" value={record?.updated_at??''}/>
      <fieldset disabled={!editing||pending} className="ea-fields grid grid-cols-2"><legend>계정 정보</legend>
        <label>서비스명<input name="service_name" required maxLength={120} defaultValue={record?.service_name??''}/></label>
        <label>서비스 접속 URL<input name="service_url" type="url" required maxLength={2000} placeholder="https://www.canva.com" defaultValue={record?.service_url??''}/></label>
        <label>계정 ID / 이메일<input name="login_id" required maxLength={254} defaultValue={record?.login_id??''}/></label>
        <label>{account?'새 비밀번호 (변경할 때만 입력)':'비밀번호'}<input name="password" type={editing?"text":"password"} disabled={!editing||pending} required={!account} maxLength={4096} autoComplete="off" spellCheck={false} autoCapitalize="none" placeholder={account?'변경할 때만 입력':''}/></label>
        <label>담당자<select name="manager_person_id" defaultValue={record?.manager_person_id||(record?.primary_manager?`legacy:${record.primary_manager}`:'')}><option value="">미지정</option>{record?.manager_person_id&&!members.some(m=>m.user_id===record.manager_person_id&&m.active!==false)&&<option value={record.manager_person_id} disabled>기존 담당자 (비활동 · 변경 시 활동 프로필 선택)</option>}{record?.primary_manager&&!record.manager_person_id&&<option value={`legacy:${record.primary_manager}`} disabled>기존 담당자: {members.find(m=>m.user_id===record.primary_manager)?.display_name??record.primary_manager}</option>}{members.filter(member=>!member.legacy&&member.active!==false).map(member=><option key={member.user_id} value={member.user_id}>{member.display_name}</option>)}</select></label>
        <label>갱신 알림 (일 전)<input type="number" min="0" max="90" required name="renewal_notice_days" defaultValue={record?.renewal_notice_days??7}/></label>
        <label>결제 주기<select name="billing_cycle" defaultValue={record?.billing_cycle??'none'}><option value="none">구독 없음</option><option value="monthly">월</option><option value="yearly">연</option></select></label>
        <label>결제 금액<input name="amount" type="number" min="0" step="0.01" max="999999999999.99" required defaultValue={record?.amount??0}/></label>
        <label>통화<select name="currency" defaultValue={record?.currency??'KRW'}>{['KRW','USD','EUR','JPY'].map(currency=><option key={currency}>{currency}</option>)}</select></label>
        <label>다음 결제일<input type="date" name="next_billing_date" defaultValue={record?.next_billing_date??''}/></label>
        <label className="ea-full">메모<textarea name="notes" maxLength={5000} defaultValue={record?.notes??''}/></label>
      </fieldset>
      <div className="ea-form-footer">
        <div className="ea-delete-action">{account&&editing&&<button type="button" disabled={pending} onClick={async event=>{if(window.confirm('정말로 이 계정 정보를 삭제하시겠습니까?'))await onSave(new FormData(event.currentTarget.form!),true);}}>계정 삭제</button>}</div>
        <div className="ea-actions">{!editing?<button type="button" className="ea-primary" disabled={pending} onClick={beginEdit}>수정</button>:<><button className="ea-primary" type="submit" disabled={pending}>{pending?'저장 중…':account?'저장':'새 계정 등록'}</button>{account&&<button type="button" disabled={pending} onClick={cancelEdit}>취소</button>}</>}</div>
      </div>
    </form>
    {account&&<><LogSection title="최근 열람 기록" logs={audit.filter(log=>['view','copy'].includes(log.action))}/><LogSection title="변경 히스토리" logs={audit.filter(log=>!['view','copy'].includes(log.action))}/><small>이 계정의 최근 100건입니다. 전체 기록은 DB에 보존됩니다.</small></>}
  </>;
}
const legacyFields=new Set(['category','department','sub_manager','payment_method']);
const fieldNames:Record<string,string>={service_name:'서비스명',service_url:'서비스 URL',login_id:'계정 ID',primary_manager:'이전 담당자',manager_person_id:'담당자',billing_cycle:'결제 주기',amount:'결제 금액',currency:'통화',next_billing_date:'다음 결제일',renewal_notice_days:'갱신 알림',notes:'메모'};
function LogSection({title,logs}:{title:string;logs:AccountLog[]}) {
  return <details className="ea-audit"><summary>{title} ({logs.length})</summary>{!logs.length&&<p>기록이 없습니다.</p>}<ol>{logs.map(log=><li key={log.id}><strong>{log.actor_name}</strong> · {{view:'비밀번호 보기',copy:'비밀번호 복사',create:'계정 생성',update:'계정 변경',delete:'계정 삭제'}[log.action]}<br/><time dateTime={log.created_at}>{new Date(log.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</time>{Object.entries(log.changes).filter(([field])=>!legacyFields.has(field)).map(([field,value])=><p key={field}>{field==='password'?'비밀번호 변경':`${fieldNames[field]??field}: ${JSON.stringify(value)}`}</p>)}</li>)}</ol></details>;
}
