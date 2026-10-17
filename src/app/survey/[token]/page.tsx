import type { Metadata } from "next";
import { connection } from "next/server";
import { getPublicSurveyState } from "@/lib/surveys";
import { PublicSurveyForm } from "@/components/surveys/public-survey-form";
import "./survey.css";

export const metadata: Metadata = { title: "말모임 참가자 설문", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const survey = await getPublicSurveyState(token);
  if (!survey.exists) return <main className="public-survey-page"><section className="public-survey-closed"><h1>설문 링크를 확인할 수 없습니다</h1><p lang="en">This survey link is unavailable.</p></section></main>;
  if (survey.state !== "open") return <main className="public-survey-page"><section className="public-survey-closed"><span className="public-survey-kicker">MALMOIM · PARTICIPANT SURVEY</span><h1>{survey.state === "closed" ? "설문이 종료되었습니다" : "아직 공개되지 않은 설문입니다"}</h1><p lang="en">{survey.state === "closed" ? "This survey is closed." : "This survey is not open yet."}</p><p>응답에는 이름이나 연락처를 수집하지 않습니다.<br/><span lang="en">We do not collect your name or contact information.</span></p></section></main>;
  return <PublicSurveyForm token={token}/>;
}
