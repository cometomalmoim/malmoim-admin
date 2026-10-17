import Link from "next/link";
import { AdminShell } from "./admin-shell";
import { getSurveyDashboard, type SurveyRecord, type SurveyStats } from "@/lib/surveys";
import { koreaDateTimeLocal, surveyAspectKeys, type SurveyAspect, type SurveyGroup } from "@/lib/survey-validation";
import { SurveyCreateForm, SurveySettingsForm, SurveyShareTools, SurveyDeleteForm } from "./survey-controls";
import "./surveys.css";

const groupNames = { korean: "한국인", international: "외국인" } as const;
const aspectLabels: Record<SurveyAspect, string> = {
  language_growth: "영어·한국어 실력 향상",
  varied_activities: "게임, 야외활동 등 다양한 활동",
  comfortable_environment: "부담 없이 편하게 말할 수 있는 환경",
  diverse_people: "다양한 사람들과의 교류",
  atmosphere_and_organization: "모임 분위기와 운영",
  mutual_learning: "서로 배우고 가르쳐 주는 상호 학습",
  none: "특별히 없음",
};
function timeLabel(value: string) { return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function effectiveStatus(survey: SurveyRecord): { label: string; className: string } {
  if (survey.status === "closed" || Date.now() >= Date.parse(survey.closes_at)) return { label: "종료", className: "closed" };
  if (survey.status === "draft") return { label: "준비 중", className: "draft" };
  if (Date.now() < Date.parse(survey.opens_at)) return { label: "공개 예정", className: "draft" };
  return { label: "공개 중", className: "open" };
}
function selectedSurveyHref(id: string, group = "all", page = 1) {
  const query = new URLSearchParams({ survey: id });
  if (group !== "all") query.set("group", group);
  if (page > 1) query.set("page", String(page));
  return `/admin/surveys?${query.toString()}`;
}
function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) { return <article className="ops-panel sv-stat"><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>; }
function GroupStats({ stats, group }: { stats: SurveyStats; group: SurveyGroup }) {
  const row = stats[group];
  return <section className="ops-panel sv-group-panel"><h3>{groupNames[group]} 응답</h3><p><strong>{row.count}</strong>명 · 평균 <strong>{row.average === null ? "—" : `${row.average} / 5`}</strong></p><div className="sv-aspects"><h4>좋았던 점 선택 비율</h4><p className="ops-muted">분모는 이 그룹의 전체 응답 수입니다. 복수 선택으로 합계가 100%를 넘을 수 있습니다.</p>{surveyAspectKeys.map(key => { const count = row.aspects[key] ?? 0; const percent = row.count ? Math.round(count / row.count * 100) : 0; return <div className="sv-aspect" key={key}><span>{aspectLabels[key]}</span><div className="sv-meter" aria-label={`${percent}%`}><i style={{ width: `${percent}%` }} /></div><strong>{count}명 · {percent}%</strong></div>; })}</div></section>;
}
function SurveyList({ surveys, selectedId }: { surveys: (SurveyRecord & { response_count: number })[]; selectedId: string }) {
  return <section className="ops-panel sv-list"><h2>기수별 설문</h2>{surveys.map(survey => { const status = effectiveStatus(survey); return <Link className={`sv-list-item${survey.id === selectedId ? " is-selected" : ""}`} key={survey.id} href={selectedSurveyHref(survey.id)} aria-current={survey.id === selectedId ? "page" : undefined}><span><strong>{survey.cohort_name}</strong><small>{timeLabel(survey.opens_at)} – {timeLabel(survey.closes_at)}</small></span><span><b className={`sv-state ${status.className}`}>{status.label}</b><small>응답 {survey.response_count}건</small></span></Link>; })}</section>;
}

export async function SurveyView({ email, surveyId, group, page = 1 }: { email: string; surveyId?: string; group?: string; page?: number }) {
  const result = await getSurveyDashboard(surveyId, group, page);
  const now = new Date();
  const defaultOpen = koreaDateTimeLocal(now.toISOString());
  const defaultClose = koreaDateTimeLocal(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString());
  return <AdminShell email={email} current="surveys" title="참가자 설문조사"><nav className="ops-breadcrumb" aria-label="페이지 이동 경로"><Link href="/admin">홈</Link><span>/</span><span>참가자 설문조사</span></nav><div className="ops-heading"><h1>기수별 참가자 설문조사</h1><p>6주 활동 경험과 만족도를 익명으로 수집하고 결과를 확인합니다.</p></div>
    <section className="ops-panel sv-privacy"><strong>익명 응답 안내</strong><p>응답 테이블에는 이름·연락처·계정 ID를 저장하지 않습니다. 공유 링크를 받은 사람은 로그인 없이 응답할 수 있습니다. 링크가 전달된 범위 밖의 참가자인지 확인하지는 않습니다.</p></section>
    {result.kind === "error" ? <section className="ops-panel sv-error" role="alert"><h2>설문 정보를 불러오지 못했습니다</h2><p>새 마이그레이션 적용 여부와 관리자 DB 권한을 확인해주세요. 임시 결과는 표시하지 않습니다.</p></section> : <div className="sv-layout"><div className="sv-main-column"><section className="ops-panel"><SurveyCreateForm defaultOpensAt={defaultOpen} defaultClosesAt={defaultClose} /></section>
      {result.selected && result.stats ? <>
        <section className="ops-panel sv-selected-head"><div><span className={`sv-state ${effectiveStatus(result.selected).className}`}>{effectiveStatus(result.selected).label}</span><h2>{result.selected.cohort_name}</h2><p className="ops-muted">응답 기간: {timeLabel(result.selected.opens_at)} – {timeLabel(result.selected.closes_at)}</p></div><span className="sv-version">문항 v1</span></section>
        <div className="sv-management-grid"><section className="ops-panel"><h2>공개·종료 관리</h2><p className="ops-muted">상태를 ‘공개’로 저장해도 공개 시작 시각 전에는 응답할 수 없습니다. 종료 시각이 지나면 자동으로 제출이 차단됩니다.</p><SurveySettingsForm id={result.selected.id} status={result.selected.status} opensAt={koreaDateTimeLocal(result.selected.opens_at)} closesAt={koreaDateTimeLocal(result.selected.closes_at)} /></section><section className="ops-panel"><h2>URL 및 QR</h2><SurveyShareTools token={result.selected.public_token} cohortName={result.selected.cohort_name} /></section></div>
        <section className="ops-panel sv-delete-panel"><h2>테스트 설문 정리</h2><p className="ops-muted">필요 없는 설문을 정리할 수 있습니다. 설문을 삭제하면 저장된 익명 응답도 함께 영구 삭제됩니다.</p><SurveyDeleteForm id={result.selected.id} cohortName={result.selected.cohort_name} responseCount={result.stats.total} /></section>
        <section className="sv-stats-grid"><StatCard label="전체 응답" value={`${result.stats.total}`} hint="익명 제출 건수"/><StatCard label="전체 평균 만족도" value={result.stats.average === null ? "—" : `${result.stats.average} / 5`} hint="질문 1 · 1~5점"/><StatCard label="한국인 그룹" value={`${result.stats.korean.count}`} hint={`평균 ${result.stats.korean.average === null ? "—" : `${result.stats.korean.average} / 5`}`}/><StatCard label="외국인 그룹" value={`${result.stats.international.count}`} hint={`평균 ${result.stats.international.average === null ? "—" : `${result.stats.international.average} / 5`}`}/></section>
        <div className="sv-group-grid"><GroupStats stats={result.stats} group="korean"/><GroupStats stats={result.stats} group="international"/></div>
        <section className="ops-panel sv-responses"><div className="sv-response-heading"><div><h2>자유 응답</h2><p className="ops-muted">질문별로 표시합니다. 응답에는 작성자 식별 정보가 없습니다.</p></div><nav aria-label="응답 그룹 필터">{(["all", "korean", "international"] as const).map(value => <Link key={value} href={selectedSurveyHref(result.selected!.id, value)} aria-current={result.group === value ? "page" : undefined}>{value === "all" ? "전체 그룹" : groupNames[value]}</Link>)}</nav></div>
          {!result.responses.some(response => response.study_feedback || response.activity_feedback || response.other_feedback) ? <div className="ops-empty"><p>표시할 자유 응답이 없습니다.</p></div> : <div className="sv-response-list">{result.responses.filter(response => response.study_feedback || response.activity_feedback || response.other_feedback).map(response => <article key={response.id}><header><strong>{groupNames[response.respondent_group]}</strong><time dateTime={response.submitted_at}>{timeLabel(response.submitted_at)}</time></header>{response.study_feedback && <section><h3>한국어·영어 스터디 개선 의견</h3><p>{response.study_feedback}</p></section>}{response.activity_feedback && <section><h3>게임·야외활동 개선 의견</h3><p>{response.activity_feedback}</p></section>}{response.other_feedback && <section><h3>기타 의견</h3><p>{response.other_feedback}</p></section>}</article>)}</div>}
          {result.responseCount > result.pageSize && <nav className="sv-pagination" aria-label="응답 페이지">{result.page > 1 && <Link href={selectedSurveyHref(result.selected.id, result.group, result.page - 1)}>← 이전</Link>}<span>{result.page} / {Math.ceil(result.responseCount / result.pageSize)}페이지 · {result.responseCount}건</span>{result.page * result.pageSize < result.responseCount && <Link href={selectedSurveyHref(result.selected.id, result.group, result.page + 1)}>다음 →</Link>}</nav>}
        </section>
      </> : <section className="ops-panel sv-empty"><h2>등록된 기수 설문이 없습니다</h2><p>기수 이름과 공개 기간을 등록하면 설문 URL·QR이 생성됩니다.</p></section>}</div><aside><SurveyList surveys={result.surveys} selectedId={result.selected?.id ?? ""}/></aside></div>}
  </AdminShell>;
}
