'use client';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { readInquiry, submitInquiry, type InquiryReceipt } from '@/app/actions/inquiries';
import { inquiryReceiptUrl, inquiryToken } from '@/lib/inquiry-validation';

export function PublicInquiryForm({ slug, english = false }: { slug: string; english?: boolean }) {
 const [state, action, busy] = useActionState(submitInquiry, { code: '' });
 const [values, setValues] = useState({ name: '', subject: '', content: '', consent: false });
 const token = useRef('');
 const [copied, setCopied] = useState(false);
 const t = (ko: string, en: string) => english ? en : ko;
 if (state.code === 'saved' && state.token) {
  const url = inquiryReceiptUrl(state.token);
  return <section className="inquiry-card" role="status"><h2>{t('문의가 접수되었어요', 'Your inquiry has been received')}</h2><p>{t('아래 전용 링크를 저장해주세요. 이 링크에서 운영진 답변을 확인할 수 있습니다. 링크를 잃어버리면 다시 찾을 수 없으니 다른 사람에게 공유하지 마세요.', 'Save your private link below to check the organizer’s reply. Keep it safe: it cannot be recovered if lost. Do not share it with others.')}</p><label>{t('답변 확인 링크', 'Private reply link')}<input readOnly value={url} onFocus={event => event.currentTarget.select()}/></label><div className="inquiry-actions"><a className="inquiry-primary" href={url}>{t('문의·답변 확인하기', 'View inquiry and replies')}</a><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); } }}>{copied ? t('복사됨', 'Copied') : t('링크 복사', 'Copy link')}</button></div><p>{t('문자는 자동 발송되지 않습니다.', 'No automatic text message is sent.')}</p></section>;
 }
 return <form className="inquiry-card" action={action} onSubmit={event => {
  if (!token.current) token.current = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
  (event.currentTarget.elements.namedItem('token') as HTMLInputElement).value = token.current;
 }}>
  <input type="hidden" name="event" value={slug}/><input type="hidden" name="locale" value={english ? 'en' : 'ko'}/><input type="hidden" name="token"/>
  <label>{t('이름 또는 닉네임', 'Name or nickname')}<input name="name" required maxLength={60} value={values.name} onChange={e => setValues({ ...values, name: e.target.value })}/></label>
  <label>{t('문의 제목', 'Subject')}<input name="subject" required maxLength={120} value={values.subject} onChange={e => setValues({ ...values, subject: e.target.value })}/></label>
  <label>{t('문의 내용', 'Your question')}<textarea name="content" required maxLength={3000} rows={7} value={values.content} onChange={e => setValues({ ...values, content: e.target.value })}/></label>
  <p>{t('전화번호·계좌번호 등 개인정보는 적지 마세요. 이름 또는 닉네임과 문의 내용은 문의 확인·답변을 위해 운영진에게 전달됩니다. 답변은 접수 후 제공되는 전용 링크에서 확인해주세요.', 'Do not include phone numbers, bank details or other personal information. Your name or nickname and question are shared with the organizers to handle your inquiry. Check the reply using the private link provided after submission.')}</p>
  <label className="inquiry-consent"><input type="checkbox" name="consent" required checked={values.consent} onChange={e => setValues({ ...values, consent: e.target.checked })}/>{t('문의 확인·답변을 위한 위 정보의 수집·이용에 동의합니다.', 'I consent to the use of the above information to handle and answer my inquiry.')}</label>
  <label className="inquiry-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
  {state.code && <p className="inquiry-error" role="alert">{state.code === 'closed' ? t('현재 문의를 받지 않는 이벤트입니다.', 'This event is not accepting inquiries.') : state.code === 'rate_limited' ? t('문의가 몰리고 있습니다. 잠시 후 다시 시도해주세요.', 'Please try again later.') : t('접수하지 못했습니다. 입력 내용을 확인한 뒤 다시 시도해주세요. 입력은 유지됩니다.', 'Unable to submit. Check your input and retry. Your input has been preserved.')}</p>}
  <button className="inquiry-primary" disabled={busy}>{busy ? t('접수 중…', 'Submitting…') : t('문의 남기기', 'Submit inquiry')}</button>
 </form>;
}

export function PublicInquiryReceipt() {
 const [item, setItem] = useState<InquiryReceipt | null>(null);
 const [code, setCode] = useState('loading');
 const [busy, start] = useTransition();
 const token = useRef('');
 const load = async (value: string) => { const result = await readInquiry(value); setCode(result.code); setItem(result.item ?? null); };
 useEffect(() => {
  token.current = new URLSearchParams(location.hash.slice(1)).get('token') ?? '';
  let active = true;
  if (inquiryToken(token.current)) void readInquiry(token.current).then(result => { if (active) { setCode(result.code); setItem(result.item ?? null); } });
  else void Promise.resolve().then(() => { if (active) setCode('missing'); });
  return () => { active = false; };
 }, []);
 const english = item?.locale === 'en';
 const t = (ko: string, en: string) => english ? en : ko;
 return <section className="inquiry-card"><h1>{t('문의·답변 확인', 'Your inquiry and replies')}</h1>{code === 'loading' ? <p role="status">확인 중… / Loading…</p> : !item ? <p role="alert">{code === 'error' ? '연결하지 못했습니다. 다시 확인해주세요. / Connection failed. Please retry.' : '문의 링크를 확인해주세요. / Please check your private link.'}</p> : <><span className="inquiry-tag">{item.status === 'answered' ? t('답변 완료', 'Answered') : t('답변 대기', 'Awaiting reply')}</span><p>{item.event_title}</p><h2>{item.subject}</h2><p className="inquiry-text">{item.content}</p><h2>{t('운영진 답변', 'Organizer’s replies')}</h2>{item.replies.length ? item.replies.map(reply => <article className="inquiry-reply" key={reply.id}><p className="inquiry-text">{reply.body}</p><time>{new Date(reply.created_at).toLocaleString(english ? 'en-GB' : 'ko-KR', { timeZone: 'Asia/Seoul' })} KST</time></article>) : <p>{t('운영진이 확인한 뒤 이곳에 답변을 남깁니다.', 'The organizers will post their reply here after reviewing your inquiry.')}</p>}</>}<button type="button" disabled={busy || code === 'loading' || code === 'missing'} onClick={() => start(() => load(token.current))}>{busy ? t('확인 중…', 'Loading…') : t('답변 새로 확인', 'Refresh replies')}</button><p>{t('이 링크를 다른 사람에게 공유하지 마세요.', 'Keep this link private.')}</p></section>;
}
