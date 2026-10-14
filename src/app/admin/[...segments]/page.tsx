import { Suspense } from "react";
import { ProtectedAdmin } from "@/components/admin/protected-admin";
export const instant = false;
async function AdminRoute({ params, searchParams }: { params: Promise<{ segments: string[] }>; searchParams: Promise<{ page?: string }> }) {
  const { segments } = await params;
  const query = await searchParams;
  return <ProtectedAdmin segments={segments} page={Number(query.page ?? "1")} />;
}
export default function Page({ params, searchParams }: { params: Promise<{ segments: string[] }>; searchParams: Promise<{ page?: string }> }) { return <Suspense fallback={<main className="login-page" role="status">접근 권한 확인 중…</main>}><AdminRoute params={params} searchParams={searchParams} /></Suspense>; }
