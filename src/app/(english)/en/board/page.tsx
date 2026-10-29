import {Suspense} from "react";
import {CommunityLoading} from "@/components/community/board-loading";
import {CommunityRoute} from "@/components/community/board-route";
export const metadata={title:"Announcements"};
export default function Page(props:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){return <Suspense fallback={<CommunityLoading locale="en" view="list"/>}><CommunityRoute {...props} locale="en" view="list"/></Suspense>;}
