import {notFound} from 'next/navigation';
export default async function Page({params}:{params:Promise<{token:string}>}){
 if(process.env.NODE_ENV!=='development')notFound();const {token}=await params;
 return <main style={{maxWidth:430,margin:'16px auto',padding:12}}><h1 style={{fontSize:20}}>모바일 폭 시연 · 390px</h1><p>실기기 인증이 아닌 개발용 화면입니다.</p><iframe src={`/preview/sign/${encodeURIComponent(token)}`} title="390px 참가자 모바일 미리보기" style={{width:390,maxWidth:'100%',height:844,border:'1px solid #bacdbb'}}/></main>;
}
