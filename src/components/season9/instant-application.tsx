"use client";
import { useRef, useState } from "react";
const bi = (ko: string, en: string) => `${ko} / ${en}`;
export function InstantApplication() {
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const steps = [bi("기본 정보","About you"),bi("연락처·희망 반","Contact & group"),bi("언어·참여","Language & participation"),bi("소개·유입 경로","Your story"),bi("확인·동의","Review & consent")];
  function move(next: number) { setStep(next); requestAnimationFrame(() => heading.current?.focus()); }
  const fields = [
    [bi("이름", "Name"), "text"], [bi("국적", "Nationality"), "text"],
    [bi("생년월일", "Date of birth"), "date"], [bi("전화번호 또는 인스타그램 ID", "Phone number or Instagram ID"), "text"],
    [bi("직업 또는 소속", "Occupation / affiliation"), "text"],
  ];
  return <div className="s9-form s9-instant"><div className="s9-step-progress"><span>{bi("단계", "Step")} {step + 1} / {steps.length}</span><progress value={step + 1} max={steps.length} aria-label={bi("신청서 진행 단계", "Form progress")}/></div><h2 ref={heading} tabIndex={-1} className="s9-step-title">{steps[step]}</h2><p id="s9-intake-status" className="s9-notice">{bi("현재 접수 준비 중입니다. 신청서 구성 미리보기이며 정보를 수집하지 않습니다.", "Applications are not open yet. This is a preview of the application form; no information is collected.")}</p>
  <fieldset disabled aria-describedby="s9-intake-status"><legend>{bi("신청서 미리보기", "Application form preview")}</legend>
    <div className="s9-fields">{fields.map(([label,type],i) => <div className="s9-field" hidden={step !== (i === 3 ? 1 : 0)} key={label}><label htmlFor={`s9-field-${i}`}>{label}</label><input id={`s9-field-${i}`} type={type} autoComplete="off" /></div>)}
    <div className="s9-field" hidden={step !== 0}><label htmlFor="s9-gender">{bi("성별", "Gender")}</label><select id="s9-gender"><option>{bi("선택", "Select")}</option><option>{bi("남성", "Male")}</option><option>{bi("여성", "Female")}</option><option>{bi("답변하지 않음", "Prefer not to say")}</option></select></div>
    <div className="s9-field" hidden={step !== 1}><label htmlFor="s9-class">{bi("희망 반", "Preferred group")}</label><select id="s9-class"><option>{bi("선택", "Select")}</option><option>{bi("목요일반", "Thursday")} 18:30–21:00</option><option>{bi("토요일반", "Saturday")} 13:00–15:30</option></select></div>
    {(["korean", "english"] as const).map(lang => <div className="s9-field" key={lang} hidden={step !== 2}><label htmlFor={`s9-${lang}`}>{lang === "korean" ? bi("한국어 수준", "Korean level") : bi("영어 수준", "English level")}</label><select id={`s9-${lang}`}><option>{bi("선택", "Select")}</option>{[bi("전혀 못함","None"),bi("조금 가능","Basic"),bi("일상 회화 가능","Intermediate"),bi("유창함","Fluent"),lang === "korean" ? bi("저는 한국 사람입니다","I am Korean") : bi("모국어","Native")].map(t=><option key={t}>{t}</option>)}</select></div>)}
    <div className="s9-field" hidden={step !== 2}><label htmlFor="s9-attendance">{bi("6회 모두 참석 가능한가요?", "Can you attend all six sessions?")}</label><select id="s9-attendance"><option>{bi("선택", "Select")}</option><option>{bi("모두 참석 가능", "Yes")}</option><option>{bi("일부만 참석 가능", "Only some sessions")}</option></select></div>
    <div className="s9-field" hidden={step !== 4}><label htmlFor="s9-payment">{bi("회비 납부 방식", "Preferred payment method")}</label><select id="s9-payment"><option>{bi("선택", "Select")}</option><option>{bi("참가 확정 후 계좌이체", "Bank transfer after confirmation")}</option><option>{bi("첫날 현금", "Cash on the first day")}</option></select></div></div>
    {[bi("참여 동기", "Why would you like to join?"), bi("자기소개", "Tell us about yourself")].map((label,i)=><div className="s9-field" hidden={step !== 3} key={label}><label htmlFor={`s9-answer-${i}`}>{label}</label><textarea id={`s9-answer-${i}`} rows={3}/></div>)}
    <fieldset className="s9-consents" hidden={step !== 3}><legend>{bi("말모임을 알게 된 경로", "How did you hear about MALMOIM?")}</legend>{[bi("인스타그램·페이스북 광고","Instagram / Facebook ads"),bi("온라인 커뮤니티","Online communities"),bi("모임 앱","Gathering apps"),bi("지인·친구 소개","Friends"),bi("오프라인 유인물","Offline materials"),bi("레딧","Reddit"),bi("기타","Other")].map(t=><label key={t}><input type="checkbox"/>{t}</label>)}</fieldset>
    <div className="s9-notice" hidden={step !== 4}><p>{bi("운영 주체: 말모임 · 문의: cometomalmoim@gmail.com", "Operator: MALMOIM · Contact: cometomalmoim@gmail.com")}</p><p>{bi("개인정보 수집 안내와 보유기간은 접수 시작 전에 확정해 안내합니다.", "The final privacy notice and retention period will be confirmed before applications open.")}</p></div>
    <div className="s9-consents" hidden={step !== 4}>{[bi("개인정보 수집·이용 — 최종 안내 준비 중","Personal information collection and use — notice pending"),bi("활동 사진 활용 — 별도 동의","Use of activity photos — separate consent"),bi("다음 기수 모집 안내 수신 — 선택 동의","Updates about future seasons — optional"),bi("참가비·환불 안내 확인","I have read the fee and refund policy")].map(t=><label key={t}><input type="checkbox"/>{t}</label>)}</div>
    <button className="s9-button" type="button" hidden={step !== 4} disabled>{bi("신청 접수 준비 중", "Applications not open")}</button>
  </fieldset><div className="s9-step-controls"><button type="button" className="s9-back" disabled={step === 0} onClick={() => move(step - 1)}>{bi("이전", "Back")}</button>{step < steps.length - 1 && <button type="button" className="s9-button" onClick={() => move(step + 1)}>{bi("다음 단계 보기", "Preview next step")} →</button>}</div><p className="s9-caption" role="status">{`미리보기 ${step + 1}/${steps.length}단계 · 제출 비활성 / Preview step ${step + 1} of ${steps.length} · Submission disabled`}</p></div>;
}
