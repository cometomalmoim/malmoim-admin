import {composeMessaging} from './messaging-templates';
export const eventSmsCategories={receipt:'신청 접수 안내',payment:'참가비 입금 요청',confirmation:'참가 최종 확정',reminder:'전날 리마인드',custom:'직접 작성'};
export type EventSmsCategory=keyof typeof eventSmsCategories;
export type EventSmsTemplate={id:string;event_id:string;template_key:string;version:number;category:EventSmsCategory;language:'ko'|'en';title:string;body:string;active:boolean;is_default:boolean;created_at:string};
export const eventSmsFields=['참가비','은행','계좌번호','예금주','영문행사명','영문장소','영문은행','영문예금주'] as const;
export function defaultSmsCategory(status:string,payment:string):EventSmsCategory{return status==='accepted'&&payment==='paid'?'confirmation':'payment';}
export function smsMessageType(text:string):'SMS'|'LMS'{return new TextEncoder().encode(text).length<=90?'SMS':'LMS';}
export function unambiguousFee(notice:string){const amounts=notice.match(/\d[\d,]*(?:\.\d+)?/g)??[];return amounts.length===1&&!/추후|미정|TBD|later/i.test(notice)?notice:'';}
export function renderEventSms(template:EventSmsTemplate,event:{title:string;starts_at:string|null;ends_at:string|null;location:string;fee_notice:string},name:string,details:Record<string,string>,fee:string){
 const en=template.language==='en',locale=en?'en-US':'ko-KR';
 const date=(stamp:string|null,opts:Intl.DateTimeFormatOptions)=>stamp?new Intl.DateTimeFormat(locale,{...opts,timeZone:'Asia/Seoul'}).format(new Date(stamp)):'';
 return composeMessaging(template.body,{'이름':name,'행사명':en?(details['영문행사명']||event.title):event.title,'행사일':date(event.starts_at,{dateStyle:'full'}),'시작시간':date(event.starts_at,{hour:'numeric',minute:'2-digit'}),'종료시간':date(event.ends_at,{hour:'numeric',minute:'2-digit'}),'장소':en?(details['영문장소']||event.location):event.location,'참가비':fee||details['참가비']||unambiguousFee(event.fee_notice),'은행':en?(details['영문은행']||details['은행']||''):(details['은행']||''),'계좌번호':details['계좌번호']||'','예금주':en?(details['영문예금주']||details['예금주']||''):(details['예금주']||'')});
}
export const halloweenSmsExamples:Pick<EventSmsTemplate,'category'|'language'|'title'|'body'>[]=[
 {category:'payment',language:'ko',title:'할로윈 참가비 입금 요청',body:'🎃 [{행사명} 신청 안내]\n\n안녕하세요, {이름}님!\n말모임 할로윈 파티에 신청해 주셔서 감사합니다.\n\n📅 날짜: {행사일}\n⏰ 시간: {시작시간} ~ {종료시간} (한국 시간)\n📍 장소: {장소}\n\n💰 참가비: {참가비}\n🏦 {은행} {계좌번호}\n예금주: {예금주}\n\n참가비 입금 확인 및 운영진 승인 후 최종 참가가 확정됩니다.\n코스튬 착용은 필수가 아니니 부담 없이 편하게 오세요! 👻\n\n말모임 운영진 드림'},
 {category:'confirmation',language:'ko',title:'할로윈 최종 참가 확정',body:'🎃 [{행사명} 참가 확정]\n\n안녕하세요, {이름}님!\n참가비 입금이 확인되어 할로윈 파티 참가가 최종 확정되었습니다! 🎉\n\n📅 날짜: {행사일}\n⏰ 시간: {시작시간} ~ {종료시간} (한국 시간)\n📍 장소: {장소}\n\n코스튬 착용은 필수가 아닙니다.\n부담 없이 편하게 오셔서 함께 즐거운 시간 보내요!\n\n말모임 운영진 드림'},
 {category:'payment',language:'en',title:'Halloween Payment Request',body:'🎃 [{행사명} Registration]\n\nHi {이름}!\nThank you for registering for the Halloween Party!\n\n📅 Date: {행사일}\n⏰ Time: {시작시간} – {종료시간} (KST)\n📍 Location: {장소}\n\n💰 Fee: {참가비}\n🏦 Bank: {은행}\nAccount: {계좌번호}\nAccount Holder: {예금주}\n\nYour spot will be officially confirmed once your payment and participation have been approved.\nCostumes are completely optional, so feel free to come as you are! 👻\n\nTeam MalMoim'},
 {category:'confirmation',language:'en',title:'Halloween Final Confirmation',body:'🎃 [{행사명} Confirmation]\n\nHi {이름}!\nYour payment has been verified, and your spot at the Halloween Party is officially confirmed! 🎉\n\n📅 Date: {행사일}\n⏰ Time: {시작시간} – {종료시간} (KST)\n📍 Location: {장소}\n\nCostumes are optional, so there is no pressure to dress up!\nWe cannot wait to see you there! 🎃\n\nTeam MalMoim'}];
