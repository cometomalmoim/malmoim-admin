import type { ResourceQuery } from "@/lib/resources";
import { Suspense } from "react";
import { ProtectedAdmin } from "@/components/admin/protected-admin";
export const instant = false;
async function AdminRoute({ params, searchParams }: { params: Promise<{ segments: string[] }>; searchParams: Promise<ResourceQuery> }) {
  const { segments } = await params;
  const raw = await searchParams;
  const query = Object.fromEntries(Object.entries(raw).filter(([,value])=>typeof value === "string")) as ResourceQuery;
  return <ProtectedAdmin segments={segments} page={Number(query.page ?? "1")} query={query} />;
}
export default function Page({ params, searchParams }: { params: Promise<{ segments: string[] }>; searchParams: Promise<ResourceQuery> }) { return <Suspense fallback={<main className="login-page" role="status">접근 권한 확인 중…</main>}><AdminRoute params={params} searchParams={searchParams} /></Suspense>; }
