import {Suspense} from 'react';
import {redirect} from 'next/navigation';
type Props={searchParams:Promise<Record<string,string|string[]|undefined>>};
export default function Page(props:Props){return <Suspense fallback={<p>신청 화면으로 이동 중… / Opening application…</p>}><ApplicationRedirect {...props}/></Suspense>;}
async function ApplicationRedirect({searchParams}:Props){
 const params=await searchParams,query=new URLSearchParams();
 for(const key of ['utm_source','utm_medium','utm_campaign','utm_term','utm_content']){const value=params[key];if(typeof value==='string')query.set(key,value.slice(0,150));}
 const suffix=query.size?'?'+query.toString():'';
 return redirect('/season9/ko'+suffix+'#application');
}
