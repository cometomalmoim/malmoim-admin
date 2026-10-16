import { ScheduleView } from './schedule-view';
import {CertificateView} from './certificate-view';
import {certificatesEnabled} from '@/lib/certificates';
import {EventAttendanceView} from './event-attendance-view';
import {MessageView} from './message-view';
import {ParticipationView} from './participation-view';
import { EventRegistrationForm } from '../event-registration-form';
import "server-only";
import { ResourceView } from "../resources/resource-view";
import type { ResourceQuery } from "@/lib/resources";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/auth";
import { adminPages } from "@/lib/admin-navigation";
import { RecruitmentView } from "./recruitment-view";
import { AdminView } from "./admin-view";
import { SuggestionsView } from "./suggestions-view";
import { EventView } from "./event-view";
import { EventDashboard } from './event-dashboard';
import { LogoutForm } from "../logout-form";
export async function ProtectedAdmin({ segments = [], page, query }: { segments?: string[]; page?: number; query?: ResourceQuery & { status?: string } }) {
  await connection();
  const access = await getAdminAccess();
  if (access.status === "anonymous") redirect("/login");
  if (access.status !== "admin") return <main className="login-page"><section className="login-card"><span className="eyebrow">접근 제한</span><h1>관리자 접근 거부</h1><p className="notice">{access.status === "error" ? "관리자 권한을 확인할 수 없습니다. 잠시 후 다시 시도해주세요." : "이 계정은 관리자로 등록되어 있지 않습니다."}</p><div className="account"><LogoutForm /></div></section></main>;
  if(segments.length===3&&segments[0]==='events'&&segments[2]==='intake-test')return <main className="login-page"><section className="login-card"><h1>관리자 신청 저장 테스트</h1><p>테스트 표시된 이벤트만 허용합니다. 가상 데이터만 입력하세요.</p><EventRegistrationForm slug={segments[1]} test/></section></main>;
  if ((segments.length === 1 && segments[0] === 'certificates') || (segments.length === 3 && segments[0] === 'events' && segments[2] === 'certificates')) return <CertificateView email={access.email} enabled={certificatesEnabled()} slug={segments[1]}/>;
  if(segments.length===1&&segments[0]==='participants')return <ParticipationView email={access.email} query={query}/>;
  if(segments.length===5&&segments[0]==='events'&&segments[2]==='participants')return <ParticipationView email={access.email} slug={segments[1]} source={segments[3]} id={segments[4]} query={query}/>;
  if(segments.length===3&&segments[0]==='events'&&segments[2]==='attendance')return <EventAttendanceView email={access.email} slug={segments[1]} page={page} query={query}/>;
  if(segments.length===1&&segments[0]==='messages')return <MessageView email={access.email}/>;
  if(segments.length===1&&segments[0]==='schedule')return <ScheduleView email={access.email}/>;
  if (segments.length === 0) return <EventDashboard email={access.email}/>;
  if (segments.length === 2 && segments[0] === "events" && segments[1] === "new") return <EventView email={access.email}/>;
  if (segments.length === 3 && segments[0] === "events" && ["overview", "information", "edit"].includes(segments[2])) return <EventView email={access.email} slug={segments[1]} edit={segments[2] === "edit"} information={segments[2] === "information"}/>;
  if (segments[0] === "resources") return <ResourceView email={access.email} parts={segments.slice(1)} query={query} />;
  if (segments[0] === "suggestions") {
    if (segments.length > 2) notFound();
    return <SuggestionsView email={access.email} id={segments[1]} status={query?.status} page={page} />;
  }
  if (segments[0] === "events" && segments[2] === "resources") return <ResourceView email={access.email} slug={segments[1]} parts={segments.slice(3)} query={query} />;
  if (segments.length === 1 && ["events", "recruitment"].includes(segments[0])) return <RecruitmentView email={access.email} recruitment={segments[0] === "recruitment"} page={page} query={query} />;
  if (segments.length === 3 && segments[0] === "events" && segments[2] === "applicants") return <RecruitmentView email={access.email} slug={segments[1]} page={page} query={query} />;
  // No event lookup exists yet. Never render an unknown ID as a real event.
  if (segments.length > 1 || !adminPages.some(p => p.slug === (segments[0] ?? ""))) notFound();
  return <AdminView segments={segments} email={access.email} />;
}
