import { PublicDetail } from "@/components/public-detail";
import { publicPages } from "@/lib/public-content";
import { publicMetadata } from "@/lib/public-metadata";
export function generateStaticParams(){return publicPages.filter(page=>page.slug!=="board").map(({slug})=>({slug}));}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){return publicMetadata("en",(await params).slug);}
export default async function Page({params}:{params:Promise<{slug:string}>}){return <PublicDetail locale="en" slug={(await params).slug}/>;}
