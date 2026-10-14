import type { SeasonLocale } from "@/lib/season9";
export function ApplicationDraft({ locale }: { locale: SeasonLocale }) {
  const en = locale === "en";
  const fields = [
    [en ? "Name" : "이름", "text"], [en ? "Nationality" : "국적", "text"],
    [en ? "Date of birth" : "생년월일", "date"], [en ? "Phone number or Instagram ID" : "전화번호 또는 인스타그램 ID", "text"],
    [en ? "Occupation / affiliation" : "직업 또는 소속", "text"],
  ];
  return <div className="s9-form"><p id="s9-intake-status" className="s9-notice">{en ? "Applications are not open yet. This is a preview of the application form; no information is collected." : "현재 접수 준비 중입니다. 신청서 구성 미리보기이며 정보를 수집하지 않습니다."}</p>
  <fieldset disabled aria-describedby="s9-intake-status"><legend>{en ? "Application form preview" : "신청서 미리보기"}</legend>
    <div className="s9-fields">{fields.map(([label,type],i) => <div className="s9-field" key={label}><label htmlFor={`s9-field-${i}`}>{label}</label><input id={`s9-field-${i}`} type={type} autoComplete="off" /></div>)}
    <div className="s9-field"><label htmlFor="s9-gender">{en ? "Gender" : "성별"}</label><select id="s9-gender"><option>{en ? "Select" : "선택"}</option><option>{en ? "Male" : "남성"}</option><option>{en ? "Female" : "여성"}</option><option>{en ? "Prefer not to say" : "답변하지 않음"}</option></select></div>
    <div className="s9-field"><label htmlFor="s9-class">{en ? "Preferred group" : "희망 반"}</label><select id="s9-class"><option>{en ? "Select" : "선택"}</option><option>{en ? "Thursday" : "목요일반"} 18:30–21:00</option><option>{en ? "Saturday" : "토요일반"} 13:00–15:30</option></select></div>
    {(["korean", "english"] as const).map(lang => <div className="s9-field" key={lang}><label htmlFor={`s9-${lang}`}>{en ? `${lang === "korean" ? "Korean" : "English"} level` : `${lang === "korean" ? "한국어" : "영어"} 수준`}</label><select id={`s9-${lang}`}><option>{en ? "Select" : "선택"}</option>{(en ? ["None","Basic","Intermediate","Fluent",lang === "korean" ? "I am Korean" : "Native"] : ["전혀 못함","조금 가능","일상 회화 가능","유창함",lang === "korean" ? "저는 한국 사람입니다" : "모국어"]).map(t=><option key={t}>{t}</option>)}</select></div>)}
    <div className="s9-field"><label htmlFor="s9-attendance">{en ? "Can you attend all six sessions?" : "6회 모두 참석 가능한가요?"}</label><select id="s9-attendance"><option>{en ? "Select" : "선택"}</option><option>{en ? "Yes" : "모두 참석 가능"}</option><option>{en ? "Only some sessions" : "일부만 참석 가능"}</option></select></div>
    <div className="s9-field"><label htmlFor="s9-payment">{en ? "Preferred payment method" : "회비 납부 방식"}</label><select id="s9-payment"><option>{en ? "Select" : "선택"}</option><option>{en ? "Bank transfer after confirmation" : "참가 확정 후 계좌이체"}</option><option>{en ? "Cash on the first day" : "첫날 현금"}</option></select></div></div>
    {[en ? "Why would you like to join?" : "참여 동기", en ? "Tell us about yourself" : "자기소개"].map((label,i)=><div className="s9-field" key={label}><label htmlFor={`s9-answer-${i}`}>{label}</label><textarea id={`s9-answer-${i}`} rows={3}/></div>)}
    <fieldset className="s9-consents"><legend>{en ? "How did you hear about MALMOIM?" : "말모임을 알게 된 경로"}</legend>{(en ? ["Instagram / Facebook ads","Online communities","Gathering apps","Friends","Offline materials","Reddit","Other"] : ["인스타그램·페이스북 광고","온라인 커뮤니티","모임 앱","지인·친구 소개","오프라인 유인물","레딧","기타"]).map(t=><label key={t}><input type="checkbox"/>{t}</label>)}</fieldset>
    <div className="s9-notice"><p>{en ? "Operator: MALMOIM · Contact: cometomalmoim@gmail.com" : "운영 주체: 말모임 · 문의: cometomalmoim@gmail.com"}</p><p>{en ? "The final privacy notice and retention period will be confirmed before applications open." : "개인정보 수집 안내와 보유기간은 접수 시작 전에 확정해 안내합니다."}</p></div>
    <div className="s9-consents">{(en ? ["Personal information collection and use — notice pending","Use of activity photos — separate consent","Updates about future seasons — optional","I have read the fee and refund policy"] : ["개인정보 수집·이용 — 최종 안내 준비 중","활동 사진 활용 — 별도 동의","다음 기수 모집 안내 수신 — 선택 동의","참가비·환불 안내 확인"]).map(t=><label key={t}><input type="checkbox"/>{t}</label>)}</div>
    <button className="s9-button" type="button" disabled>{en ? "Applications not open" : "신청 접수 준비 중"}</button>
  </fieldset></div>;
}
