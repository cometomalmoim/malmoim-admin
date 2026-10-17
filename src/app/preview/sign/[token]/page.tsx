import {Suspense} from 'react';
import {notFound} from 'next/navigation';
import {DemoParticipant} from '@/components/document-admin/demo-participant';
export const metadata={title:'말모임 개발 전용 서명 시연',robots:{index:false,follow:false},referrer:'no-referrer'};
async function ParticipantContent({params}:{params:Promise<{token:string}>}){
 if(process.env.NODE_ENV!=='development')notFound();
 const {token}=await params;return <DemoParticipant key={token} token={token}/>;
}

export default function Page({params}:{params:Promise<{token:string}>}){
 if(process.env.NODE_ENV!=='development')notFound();
 return <Suspense fallback={<p>개발 시연 문서를 여는 중입니다…</p>}><ParticipantContent params={params}/></Suspense>;
}
