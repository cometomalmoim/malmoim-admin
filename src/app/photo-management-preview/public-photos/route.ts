import {NextRequest,NextResponse} from 'next/server';
import {developmentBroker} from '@/lib/history-activities/development-storage';
import {isPhotoLabRequest} from '@/lib/history-activities/development-target';
import type {HistoryPhoto} from '../../(public)/history/history-data';
export async function GET(r:NextRequest){
 const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Host'};
 if(!isPhotoLabRequest(process.env.NODE_ENV,r.headers.get('host')))return NextResponse.json({photos:[]},{status:404,headers});
 try{
  // No session/cookie/request body forwarded. Broker uses public-read-only DB role.
  const {photos}=await developmentBroker<{photos:HistoryPhoto[]}>({op:'public'});
  const safe=photos.map(p=>({id:p.id,title:p.title,date:p.date,description:p.description,category:p.category,...(p.category==='regular'?{cohort:p.cohort}:{}),src:p.src,alt:p.alt,slidePhotos:p.slidePhotos?.map(s=>({src:s.src,alt:s.alt}))}));
  return NextResponse.json({photos:safe},{headers});
 }catch{return NextResponse.json({photos:[]},{status:503,headers});}
}
