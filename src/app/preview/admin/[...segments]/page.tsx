import type { ResourceQuery } from "@/lib/resources";
import { ResourceView } from "@/components/resources/resource-view";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { adminPages, eventTabs } from "@/lib/admin-navigation";
import { AdminView } from "@/components/admin/admin-view";
export const instant = false;
async function PreviewRoute({ params, searchParams }: { params: Promise<{ segments: string[] }>; searchParams: Promise<ResourceQuery> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { segments } = await params;
  if (segments[0] === "resources") {
    const raw = await searchParams;
    const query = Object.fromEntries(Object.entries(raw).filter(([,value])=>typeof value === "string")) as ResourceQuery;
    return <ResourceView email="" parts={segments.slice(1)} query={query} preview />;
  }
  if (!adminPages.some(p => p.slug === segments[0])) notFound();
  if (segments.length > 1 && (segments[0] !== "events" || segments[1] !== "structure" || segments.length > 3 || !eventTabs.some(t => t.slug === (segments[2] ?? "overview")))) notFound();
  return <AdminView segments={segments} preview />;
}

export default function Page({ params, searchParams }: { params: Promise<{ segments: string[] }>; searchParams: Promise<ResourceQuery> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Suspense fallback={<p role="status">미리보기 준비 중…</p>}><PreviewRoute params={params} searchParams={searchParams} /></Suspense>;
}
