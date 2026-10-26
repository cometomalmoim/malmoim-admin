import { Suspense } from "react";
import { PublicDetailLoading } from "@/components/public-detail-loading";
import { PublicDetail } from "@/components/public-detail";
import { publicPages } from "@/lib/public-content";
import { publicMetadata } from "@/lib/public-metadata";
export function generateStaticParams(){return publicPages.filter(page=>page.slug!=="board").map(({slug})=>({slug}));}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){return publicMetadata("en",(await params).slug);}
type DetailPageProps = { params: Promise<{ slug: string }> };

async function DetailContent({ params }: DetailPageProps) {
  return <PublicDetail locale="en" slug={(await params).slug} />;
}

export default function Page({ params }: DetailPageProps) {
  return (
    <Suspense fallback={<PublicDetailLoading locale="en" />}>
      <DetailContent params={params} />
    </Suspense>
  );
}
