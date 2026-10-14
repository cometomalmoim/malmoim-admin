import "server-only";
import { ResourceView } from "../resources/resource-view";
import type { ResourceQuery } from "@/lib/resources";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/auth";
import { adminPages } from "@/lib/admin-navigation";
import { RecruitmentView } from "./recruitment-view";
import { AdminView } from "./admin-view";
import { LogoutForm } from "../logout-form";
export async function ProtectedAdmin({ segments = [], page, query }: { segments?: string[]; page?: number; query?: ResourceQuery }) {
  await connection();
  const access = await getAdminAccess();
  if (access.status === "anonymous") redirect("/login");
  if (access.status !== "admin") return <main className="login-page"><section className="login-card"><span className="eyebrow">접근 제한</span><h1>관리자 접근 거부</h1><p className="notice">{access.status === "error" ? "관리자 권한을 확인할 수 없습니다. 잠시 후 다시 시도해주세요." : "이 계정은 관리자로 등록되어 있지 않습니다."}</p><div className="account"><LogoutForm /></div></section></main>;
  if (segments[0] === "resources") return <ResourceView email={access.email} parts={segments.slice(1)} query={query} />;
  if (segments[0] === "events" && segments[2] === "resources") return <ResourceView email={access.email} slug={segments[1]} parts={segments.slice(3)} query={query} />;
  if (segments.length === 1 && ["events", "recruitment"].includes(segments[0])) return <RecruitmentView email={access.email} recruitment={segments[0] === "recruitment"} />;
  if (segments.length === 3 && segments[0] === "events" && segments[2] === "applicants") return <RecruitmentView email={access.email} slug={segments[1]} page={page} />;
  // No event lookup exists yet. Never render an unknown ID as a real event.
  if (segments.length > 1 || !adminPages.some(p => p.slug === (segments[0] ?? ""))) notFound();
  return <AdminView segments={segments} email={access.email} />;
}
