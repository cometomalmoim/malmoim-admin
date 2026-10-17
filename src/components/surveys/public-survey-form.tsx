"use client";
import { useActionState, useState } from "react";
import { submitSurveyResponseAction } from "@/app/actions/surveys";
import { surveyAspectKeys, type SurveyAspect, type SurveyGroup } from "@/lib/survey-validation";

const initialState = { message: "", ok: false };
const copy = {
  korean: {
    title: "말모임 경험 설문", intro: "이 설문은 익명으로 진행되며 이름이나 연락처를 수집하지 않습니다.", group: "응답 언어를 선택해주세요", korean: "한국인 · 한국어", international: "외국인 · English", change: "그룹 다시 선택", required: "필수", optional: "선택", q1: "지난 6주 동안 말모임은 얼마나 만족스러웠나요?", q2: "말모임에서 좋았던 점은 무엇인가요?", q3: "한국어·영어 스터디에서 개선했으면 하는 점이 있나요?", q4: "게임·야외활동 시간에 개선했으면 하는 점이나 해보고 싶은 활동이 있나요?", q5: "기타 요청사항이나 운영진에게 하고 싶은 말이 있나요?", submit: "익명으로 제출", sending: "제출 중…", select: "선택해주세요", textPlaceholder: "편하게 의견을 적어주세요", scaleLow: "전혀 만족하지 않음", scaleHigh: "매우 만족", aspects: ["영어·한국어 실력 향상", "게임, 야외활동 등 다양한 활동", "부담 없이 편하게 말할 수 있는 환경", "다양한 사람들과의 교류", "모임 분위기와 운영", "서로 배우고 가르쳐 주는 상호 학습", "특별히 없음"],
  },
  international: {
    title: "MALMOIM Experience Survey", intro: "Your responses are anonymous. We do not collect your name or contact information.", group: "Choose your response language", korean: "Korean participant · 한국어", international: "International participant · English", change: "Choose group again", required: "Required", optional: "Optional", q1: "How satisfied were you with Malmoim over the past six weeks?", q2: "What did you like about Malmoim?", q3: "Do you have any suggestions for improving our Korean and English study sessions?", q4: "Do you have any suggestions for our games and outdoor activities, or activities you'd like to try?", q5: "Any other requests, feedback, or messages for the organizers?", submit: "Submit anonymously", sending: "Submitting…", select: "Select an answer", textPlaceholder: "Share any thoughts you'd like", scaleLow: "Not satisfied", scaleHigh: "Very satisfied", aspects: ["Improving English or Korean skills", "Variety of activities, such as games and outdoor events", "A comfortable, low-pressure environment to speak freely", "Interacting with diverse people", "The atmosphere and organization", "Mutual learning and teaching", "Nothing in particular"],
  },
} as const;

export function PublicSurveyForm({ token }: { token: string }) {
  const [group, setGroup] = useState<SurveyGroup | null>(null);
  const [selectedAspects, setSelectedAspects] = useState<SurveyAspect[]>([]);
  const actionForToken = submitSurveyResponseAction.bind(null, token);
  const [state, action, pending] = useActionState(actionForToken, initialState);
  const t = copy[group ?? "korean"];
  function toggleAspect(key: SurveyAspect) {
    setSelectedAspects(current => key === "none" ? (current.includes("none") ? [] : ["none"]) : (current.includes(key) ? current.filter(value => value !== key) : [...current.filter(value => value !== "none"), key]));
  }
  return <main className="public-survey-page" lang={group === "international" ? "en" : "ko"}>
    <div className="public-survey-wrap"><span className="public-survey-kicker">MALMOIM · 6 WEEK EXPERIENCE</span>
      {!group ? <section className="public-survey-choice"><h1>참가자 설문조사<br/><span lang="en">Participant survey</span></h1><p>응답 그룹을 선택하면 해당 언어로 설문을 표시합니다. 선택은 본인 응답에 따른 통계에만 사용됩니다.</p><p className="public-survey-anonymity">이 설문은 익명으로 진행되며 이름이나 연락처를 수집하지 않습니다.<br/><span lang="en">Your responses are anonymous. We do not collect your name or contact information.</span></p><h2>{copy.korean.group}</h2><div className="public-survey-group-choice"><button type="button" onClick={() => setGroup("korean")}>{copy.korean.korean}</button><button type="button" onClick={() => setGroup("international")}>{copy.international.international}</button></div></section> : <>
        <header className="public-survey-heading"><button type="button" className="public-survey-change" onClick={() => setGroup(null)}>{t.change}</button><h1>{t.title}</h1><p>{t.intro}</p></header>
        {state.ok ? <section className="public-survey-thanks" role="status"><strong>{state.message}</strong><p>{group === "korean" ? "응답에는 작성자 이름이나 계정 정보가 포함되지 않습니다." : "Your response is not connected to a name or account."}</p></section> : <form className="public-survey-form" action={action} aria-busy={pending}>
          <input type="hidden" name="group" value={group}/>
          <fieldset className="public-survey-question"><legend><span>01</span>{t.q1}<small>{t.required}</small></legend><div className="public-survey-scale">{[1,2,3,4,5].map(value => <label key={value}><input type="radio" name="satisfaction" value={value} required/><span>{value}</span></label>)}</div><div className="public-survey-scale-labels"><span>{t.scaleLow}</span><span>{t.scaleHigh}</span></div></fieldset>
          <fieldset className="public-survey-question"><legend><span>02</span>{t.q2}<small>{t.required}</small></legend><div className="public-survey-aspects">{surveyAspectKeys.map((key,index) => <label key={key}><input type="checkbox" name="liked_aspects" value={key} checked={selectedAspects.includes(key)} onChange={() => toggleAspect(key)}/><span>{t.aspects[index]}</span></label>)}</div><p className="public-survey-hint">{group === "korean" ? "‘특별히 없음’은 다른 항목과 함께 선택할 수 없습니다." : "‘Nothing in particular’ cannot be selected with other options."}</p></fieldset>
          {([ ["study_feedback",t.q3], ["activity_feedback",t.q4], ["other_feedback",t.q5] ] as const).map(([name,label],index)=><label className="public-survey-question public-survey-text" key={name}><span className="public-survey-question-title"><span>0{index+3}</span>{label}<small>{t.optional}</small></span><textarea name={name} rows={4} maxLength={3000} placeholder={t.textPlaceholder}/></label>)}
          {state.message && <p className="public-survey-message" role="alert">{state.message}</p>}
          <button className="public-survey-submit" disabled={pending}>{pending ? t.sending : t.submit}</button><p className="public-survey-footnote">{group === "korean" ? "제출 후에는 응답을 수정할 수 없습니다." : "Submitted responses cannot be edited."}</p>
        </form>}
      </>}
    </div>
  </main>;
}
