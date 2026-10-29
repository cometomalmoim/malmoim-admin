import {Suspense} from "react";
import {AnnouncementLoading} from "@/components/community/announcements";
import {CommunityRoute} from "@/components/community/board-route";
export const metadata={title:"주요 안내사항"};
export default function Page(props:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){return <Suspense fallback={<AnnouncementLoading locale="ko"/>}><CommunityRoute {...props} locale="ko"/></Suspense>;}
