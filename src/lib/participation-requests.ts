export type ParticipationKind = 'daily' | 'exchange';
export const exchangeLanguages = ['ko','en','ja','zh','es','fr','de','other'] as const;
export const languageNames: Record<string,[string,string]> = {ko:['한국어','Korean'],en:['영어','English'],ja:['일본어','Japanese'],zh:['중국어','Chinese'],es:['스페인어','Spanish'],fr:['프랑스어','French'],de:['독일어','German'],other:['그 외 언어','Other']};
export const requestStatuses = ['received','reviewing','confirmed','waitlisted','declined','cancelled'] as const;
export const requestStatusNames: Record<string,[string,string]> = {received:['접수','Received'],reviewing:['검토 중','Under review'],confirmed:['확정','Confirmed'],waitlisted:['대기','Waitlisted'],declined:['진행 불가','Unable to proceed'],cancelled:['취소','Cancelled']};
export type DailySession = {id:string;title:string;starts_at:string;ends_at:string;location:string;fee:number;closes_at:string};
export type ParticipationInfo = {available:boolean;exchange_open:boolean;sessions:DailySession[]};
export const requestToken = (v:string) => /^[a-f0-9]{64}$/.test(v);
export const requestId = (v:string) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
export function participationInput(form:FormData) {
 const text=(key:string)=>String(form.get(key)??'').trim();
 const kind=text('kind'),name=text('name'),contact=text('contact'),contactType=text('contact_type'),token=text('token'),locale=text('locale');
 if(!['daily','exchange'].includes(kind)||!name||name.length>60||!requestToken(token)||!['ko','en'].includes(locale)||form.get('consent')!=='on'||text('website')) return null;
 if(!['email','phone','instagram'].includes(contactType)||contact.length>120||
  (contactType==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))||
  (contactType==='phone'&&(!/^\+?[0-9 ()-]{8,30}$/.test(contact)||!/^\+?[0-9]{8,15}$/.test(contact.replace(/[ ()-]/g,''))))||
  (contactType==='instagram'&&!/^@?[A-Za-z0-9._]{1,30}$/.test(contact)))return null;
 const notes=text('notes');if(notes.length>500)return null;
 const sessionId=text('session_id');
 const details:Record<string,string>={notes};
 if(kind==='daily') {if(!requestId(sessionId))return null;}
 else {
  for(const key of ['offered_language','learning_language']) {const value=text(key);if(!exchangeLanguages.some(l=>l===value))return null;details[key]=value;}
  if(details.offered_language===details.learning_language&&details.offered_language!=='other')return null;
  for(const key of ['offered_level','learning_level']){const value=text(key);if(!['beginner','intermediate','advanced','native'].includes(value))return null;details[key]=value;}
  if(!['online','offline','either'].includes(text('meeting_mode')))return null;
  const availability=text('availability'),area=text('area'),other=text('other_languages');
  if(!availability||availability.length>200||area.length>100||other.length>100||
   (text('meeting_mode')!=='online'&&!area)||([details.offered_language,details.learning_language].includes('other')&&!other))return null;
  Object.assign(details,{meeting_mode:text('meeting_mode'),availability,area,other_languages:other});
 }
 return {kind:kind as ParticipationKind,name,contact,contactType,token,locale,sessionId:kind==='daily'?sessionId:null,details};
}
export function sessionInput(form:FormData) {
 const text=(key:string)=>String(form.get(key)??'').trim();
 const date=(key:string)=>{const v=text(key);if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v))return null;const d=new Date(v+':00+09:00');return Number.isFinite(d.getTime())&&new Date(d.getTime()+9*3600000).toISOString().slice(0,16)===v?d.toISOString():null;};
 const starts=date('starts_at'),ends=date('ends_at'),closes=date('closes_at'),title=text('title'),location=text('location'),fee=Number(text('fee'));
 if(!title||title.length>100||!location||location.length>200||!starts||!ends||!closes||ends<=starts||closes>starts||!text('fee')||!Number.isSafeInteger(fee)||fee<0||fee>1000000)return null;
 return {title,location,starts_at:starts,ends_at:ends,closes_at:closes,fee};
}
