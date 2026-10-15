import { PublicDetail } from "@/components/public-detail";
import { publicPages } from "@/lib/public-content";
import { publicMetadata } from "@/lib/public-metadata";
export function generateStaticParams() { return publicPages.map(({slug})=>({slug})); }
export async function generateMetadata({params}:{params:Promise<{slug:string}>}) { return publicMetadata("ko",(await params).slug); }
export default async function Page({params}:{params:Promise<{slug:string}>}) { return <PublicDetail slug={(await params).slug}/>; }
