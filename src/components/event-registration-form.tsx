 'use client';
import {startTransition,useActionState,useEffect,useState} from 'react';
import {readAttribution,type Attribution} from '@/lib/attribution';
import {registerEvent,registrationInfo} from '@/app/actions/registration';
import {HalloweenAgeNotice}from './halloween-age-notice';
export function EventRegistrationForm({slug='halloween-2026',test=false,english=false}:{slug?:string;test?:boolean;english?:boolean}) {
 const [attribution,setAttribution]=useState<Attribution>({utm_source:'',utm_medium:'',utm_campaign:''});
 const [info,setInfo]=useState<{open:boolean;unavailable?:boolean;notice?:string;version?:string;marketingNotice?:string}>({open:false});
 const [submission,setSubmission]=useState('');
 const [history,setHistory]=useState('');
 const [name,setName]=useState('');
 const [contact,setContact]=useState('');
 const [birthYear,setBirthYear]=useState('');
 const [detail,setDetail]=useState('');
 const [privacy,setPrivacy]=useState(false);
 const [marketing,setMarketing]=useState(false);
 const [state,action,pending]=useActionState(registerEvent.bind(null,slug,test),{code:''});
 useEffect(()=>{let active=true;const tags=readAttribution(new URLSearchParams(window.location.search));registrationInfo(slug,test).then(value=>{if(active){setAttribution(tags);setInfo(value);setSubmission(crypto.randomUUID());}}).catch(()=>{if(active)setInfo({open:false,unavailable:true});});return ()=>{active=false;};},[slug,test]);
 useEffect(()=>{if(state.code!=='consent')return;let active=true;registrationInfo(slug,test).then(value=>{if(active){setInfo(value);setPrivacy(false);}}).catch(()=>{if(active)setInfo({open:false,unavailable:true});});return()=>{active=false;};},[state.code,slug,test]);
 const t=(ko:string,en:string)=>english?en:ko;
 const messages:Record<string,string>={birth_year:t('출생연도는 1900년부터 올해 사이의 4자리 숫자로 입력해주세요.','Enter a four-digit birth year between 1900 and the current year.'),saved:t('신청이 저장되었습니다. 참가 확정 안내는 별도로 진행됩니다.','Your application was saved. Participation confirmation will follow separately.'),duplicate:t('이미 신청된 연락처입니다. 변경이 필요하면 운영진에게 문의해주세요.','This phone number is already registered. Contact the organizers to make changes.'),closed:t('현재 접수 기간이 아니거나 접수가 닫혀 있습니다.','Registration is closed or outside the application period.'),consent:t('최신 개인정보 안내를 확인하고 동의해주세요.','Read and agree to the latest privacy notice.'),full:t('모집 정원이 마감되었습니다.','Registration is full.'),invalid:t('입력 항목을 확인해주세요.','Please check your entries.'),busy:t('신청 요청이 많습니다. 잠시 후 다시 시도해주세요.','Too many requests. Please retry shortly.'),error:t('저장하지 못했습니다. 입력을 유지한 채 다시 시도해주세요.','Could not save. Your entries are retained; please retry.')};
 if(state.code==='saved')return <section className={test?"evt-form":"hw-form"} role="status"><h3>{t('신청 접수 완료','Application received')}</h3><p>{messages.saved}</p></section>;
 return <form className={test?"evt-form":"hw-form"} onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);startTransition(()=>action(data));}} aria-label={t('이벤트 참가 신청','Event registration')}><h3>{test?'관리자 가상 데이터 테스트':t('할로윈 파티 참가 신청','Halloween party registration')}</h3>{!info.open&&<p>{info.unavailable?t('접수 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.','Unable to check registration. Please retry shortly.'):t('현재 접수 기간이 아니거나 접수가 닫혀 있습니다.','Registration is closed or outside the application period.')}</p>}
 {!test&&slug==='halloween-2026'&&<HalloweenAgeNotice english={english}/>}
 <fieldset disabled={!info.open||pending||!submission}>
 {Object.entries(attribution).map(([key,value])=><input key={key} type="hidden" name={key} value={value}/>)}
 <input type="hidden" name="submission_id" value={submission}/><input type="hidden" name="version" value={info.version??''}/>
 <div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
 <label>{t('이름','Name')}<input name="name" value={name} onChange={event=>setName(event.target.value)} required maxLength={100} autoComplete="name"/></label>
 <label>{t('전화번호','Phone number')}<input name="contact" value={contact} onChange={event=>setContact(event.target.value)} required maxLength={40} type="tel" autoComplete="tel"/></label>
 <label>{t('출생연도 (선택)','Birth year (optional)')}<input name="birth_year" value={birthYear} onChange={event=>setBirthYear(event.target.value)} inputMode="numeric" type="text" pattern="[0-9]{4}" maxLength={4} autoComplete="bday-year" placeholder={t('예: 1998','e.g. 1998')} aria-describedby="birth-year-help"/><small id="birth-year-help">{t('출생연도 4자리만 입력해주세요. 미입력해도 신청할 수 있습니다.','Enter your four-digit birth year. You can apply without it.')}</small></label>
 <label>{t('말모임 참가 이력','Past MALMOIM participation')}<select name="history" required value={history} onChange={event=>setHistory(event.target.value)}><option value="">{t('선택해주세요','Select')}</option><option value="new">{t('참가한 적 없음','First time')}</option><option value="returning">{t('참가한 적 있음','Returning participant')}</option></select></label>
 <label>{t('참가한 기수·활동명 (선택)','Season or activity (optional)')}<input name="history_detail" value={detail} onChange={event=>setDetail(event.target.value)} maxLength={300} disabled={history!=='returning'}/></label>
 {info.notice&&<p style={{whiteSpace:'pre-wrap'}}>{info.notice}</p>}
 <label className="hw-consent"><input name="privacy_consent" type="checkbox" checked={privacy} onChange={event=>setPrivacy(event.target.checked)} required/><span>{t('개인정보 수집·이용에 동의합니다.','I agree to the collection and use of personal information.')}</span></label>
 {info.marketingNotice&&<><p style={{whiteSpace:'pre-wrap'}}>{info.marketingNotice}</p><label className="hw-consent"><input name="marketing_consent" type="checkbox" checked={marketing} onChange={event=>setMarketing(event.target.checked)}/><span>{t('마케팅 안내 수신 동의 (선택, 미동의해도 신청 가능)','Marketing updates (optional; not required to apply)')}</span></label></>}
 <button type="submit">{pending?t('저장 중…','Saving…'):info.open?t('신청하기','Submit application'):t('신청 오픈 준비 중','Registration coming soon')}</button></fieldset>
 <p role="status" aria-live="polite">{messages[state.code]??''}</p></form>;
}
