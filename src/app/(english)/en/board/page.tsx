import {Suspense} from "react";
import {AnnouncementLoading} from "@/components/community/announcements";
import {CommunityRoute} from "@/components/community/board-route";
export const metadata={title:"Announcements"};
export default function Page(props:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){return <Suspense fallback={<AnnouncementLoading locale="en"/>}><CommunityRoute {...props} locale="en"/></Suspense>;}
