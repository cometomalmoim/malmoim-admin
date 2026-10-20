import {Suspense} from "react";
import {CommunityRoute} from "@/components/community/board-route";
export const metadata={title:"게시판"};
export default function Page(props:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){return <Suspense fallback={<main id="public-main" role="status">게시판을 불러오고 있습니다…</main>}><CommunityRoute {...props} locale="ko" view="detail"/></Suspense>;}
