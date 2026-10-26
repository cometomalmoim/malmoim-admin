'use server';
import {getAdminAccess} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
export type FormResponse = {code:'ready';fields:[string,string][]}|{code:'error'|'missing'};
export async function getApplicantResponse(eventId:string,source:string,id:string):Promise<FormResponse>{
 if((await getAdminAccess()).status!=='admin')return {code:'error'};
 if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[0-9a-f-]{36}$/i.test(eventId)||!['season9','registration','manual'].includes(source))return {code:'error'};
 if(source==='manual')return {code:'ready',fields:[['접수 방식','운영진이 직접 추가한 신청자입니다. 별도 온라인 신청서가 없습니다.']]};
 try{
  const client=await createClient();
  const season=source==='season9';
  const {data,error}=await client.from(season?'event_applications':'event_registration_responses').select(season?'name,nationality,birth_year,application_kind,gender,date_of_birth,occupation,preferred_class,korean_level,english_level,motivation,introduction,full_attendance,referral_sources,payment_method,privacy_consent,photo_consent,future_updates_consent,fee_policy_confirmed':'name,participation_history,history_detail,privacy_consent,marketing_consent').eq('event_id',eventId).eq('id',id).maybeSingle();
  if(error)return {code:'error'};if(!data)return {code:'missing'};
  const row=data as unknown as Record<string,unknown>;
  const labels:Record<string,string>=season?{name:'이름',nationality:'국적',birth_year:'출생연도',application_kind:'참여 유형 (본인 응답)',gender:'성별',date_of_birth:'생년월일',occupation:'직업·소속',preferred_class:'희망 반',korean_level:'한국어 수준',english_level:'영어 수준',motivation:'참여 동기',introduction:'기대 활동·추가 소개',full_attendance:'전 회차 참석 가능 여부',referral_sources:'알게 된 경로',payment_method:'납부 희망 방식',privacy_consent:'개인정보 동의',photo_consent:'사진 활용 동의',future_updates_consent:'다음 기수 안내 동의',fee_policy_confirmed:'참가비 안내 확인'}:{name:'이름',participation_history:'기존 참여 여부',history_detail:'참여 이력 응답',privacy_consent:'개인정보 동의',marketing_consent:'마케팅 동의'};
  const display=(v:unknown)=>v===true?'예':v===false?'아니요':Array.isArray(v)?v.join(', ')||'미입력':({thursday:'목요일반',saturday:'토요일반',new:'첫 참여',returning:'기존 참여'}[String(v)]??String(v??'').trim())||'미입력';
  return {code:'ready',fields:Object.entries(labels).filter(([key])=>!season||!row.application_kind||['name','nationality','birth_year','application_kind','preferred_class','privacy_consent','photo_consent','fee_policy_confirmed'].includes(key)).map(([key,label])=>[label,display(row[key])])};
 }catch{return {code:'error'};}
}
