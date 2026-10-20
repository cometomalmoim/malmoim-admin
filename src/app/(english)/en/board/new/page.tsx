import {Suspense} from "react";
import {CommunityRoute} from "@/components/community/board-route";
export const metadata={title:"Community board"};
export default function Page(props:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){return <Suspense fallback={<main id="public-main" role="status">Loading the board…</main>}><CommunityRoute {...props} locale="en" view="new"/></Suspense>;}
