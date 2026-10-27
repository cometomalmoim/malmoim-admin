import {META_PIXEL_ID,type MetaWindow} from './meta-pixel';
import type {MetaRegistrationReceipt} from './meta-registration-receipt';
type Context={host:string;path:string;storage:Pick<Storage,'getItem'|'setItem'>;lock:(name:string,callback:()=>Promise<boolean>)=>Promise<boolean>};
function matches(receipt:MetaRegistrationReceipt,path:string){return receipt.event==='season9'?['/season9','/season9/ko','/season9/en','/season9/apply','/season9/en/apply','/season9/apply/en'].includes(path):path==='/2026halloweenparty'||path==='/2026halloweenparty/en';}
/** At-most-once browser dispatch; a blocked/failed pixel never fails the registration. */
export async function completeRegistration(w:MetaWindow,receipt:MetaRegistrationReceipt|undefined,ctx:Context):Promise<boolean>{
 try{
  if(!receipt||!['season9','halloween-2026'].includes(receipt.event)||!['ko','en'].includes(receipt.language)||!new RegExp(`^registration:${receipt.event}:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`).test(receipt.eventId))return false;
  const eligible=()=>['malmoim.com','www.malmoim.com'].includes(ctx.host)&&matches(receipt,ctx.path)&&w.malmoimMetaReady===true&&!!w.fbq;
  if(!eligible())return false;
  const key=`malmoim-meta-complete-v1:${receipt.eventId}`;
  return await ctx.lock(key,async()=>{
   if(!eligible()||ctx.storage.getItem(key))return false;
   // Persist before handing the event to Meta: never retry ambiguous dispatches.
   // If persistence is unavailable, prefer missing analytics over duplicates.
   ctx.storage.setItem(key,'dispatched');
   if(ctx.storage.getItem(key)!=='dispatched')return false;
   w.fbq!('consent','grant');
   w.fbq!('trackSingle',META_PIXEL_ID,'CompleteRegistration',{event_slug:receipt.event,language:receipt.language},{eventID:receipt.eventId});
   return true;
  });
 }catch{return false;}
}
