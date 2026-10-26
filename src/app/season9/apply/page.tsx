import {redirect} from 'next/navigation';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams,query=new URLSearchParams();
 for(const key of ['utm_source','utm_medium','utm_campaign','utm_term','utm_content']){const value=params[key];if(typeof value==='string')query.set(key,value.slice(0,150));}
 const suffix=query.size?'?'+query.toString():'';
 redirect('/season9/ko'+suffix+'#application');
}
