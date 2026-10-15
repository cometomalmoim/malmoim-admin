"use server";
import { createClient } from "@/lib/supabase/server";
export type SubmissionState = { success: boolean; message: string };
export async function submitSeason9(_state: SubmissionState, form: FormData): Promise<SubmissionState> {
  const fail = (message:string): SubmissionState => ({success:false,message});
  if (String(form.get("website") ?? "")) return fail("신청을 처리하지 못했습니다. / Unable to process the application.");
  const value = (name:string,max=200) => String(form.get(name) ?? "").trim().slice(0,max);
  const name=value("s9-field-0",100), nationality=value("s9-field-1",100), birth=value("s9-field-2"), contact=value("s9-field-3"), preferred=value("s9-class");
  if (!name || !nationality || !contact || !["thursday","saturday"].includes(preferred)) return fail("이름·국적·연락처·희망 반을 확인해주세요. / Check your name, nationality, contact and preferred group.");
  const d=new Date(birth+"T00:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==birth||d.getTime()>Date.now()) return fail("생년월일을 확인해주세요. / Check your date of birth.");
  const contactType=value("contact_type");
  if (contactType==="phone" ? !/^\+?[0-9]{8,15}$/.test(contact.replace(/[\s()-]/g,"")) : contactType!=="instagram"||!/^@?[A-Za-z0-9_.]{1,30}$/.test(contact)) return fail("전화번호 또는 인스타그램 ID 형식을 확인해주세요. / Check your phone number or Instagram ID.");
  if (form.get("privacy_consent")!=="on"||form.get("fee_confirmed")!=="on") return fail("개인정보 수집과 참가비 안내 확인이 필요합니다. / Privacy consent and fee policy confirmation are required.");
  const submissionId=value("submission_id");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId)) return fail("페이지를 새로 열어 다시 시도해주세요. / Reopen the page and try again.");
  const payload: Record<string,unknown>={submission_id:submissionId,name,nationality,date_of_birth:birth,contact,contact_type:contactType,preferred_class:preferred,gender:value("s9-gender"),occupation:value("s9-field-4"),korean_level:value("s9-korean"),english_level:value("s9-english"),motivation:value("s9-answer-0",2000),introduction:value("s9-answer-1",2000),full_attendance:form.get("s9-attendance")==="yes",referral_sources:form.getAll("referral_sources").map(x=>String(x).slice(0,100)).slice(0,10),payment_method:value("s9-payment"),notice_version:"season9-2026-10-14-v1",privacy_consent:true,fee_confirmed:true,photo_consent:form.get("photo_consent")==="on",future_updates_consent:form.get("future_updates_consent")==="on"};
  for(const key of ["utm_source","utm_medium","utm_campaign","utm_term","utm_content"]) payload[key]=value(key,150)||null;
  try {
    const client=await createClient(); const {data,error}=await client.rpc("submit_season9_application",{payload});
    if(error){const reason=error.message;return fail(reason.includes("recruitment_closed")?"현재 신청을 받지 않거나 모집이 마감되었습니다. / Applications are not open or have closed.":reason.includes("rate_limited")?"신청이 몰리고 있습니다. 잠시 후 다시 시도해주세요. / Please try again shortly.":"저장하지 못했습니다. 입력은 유지됩니다. 다시 시도해주세요. / Unable to save. Your input is preserved; please retry.");}
    if(data?.accepted!==true) return fail("접수를 확인하지 못했습니다. 다시 시도해주세요. / Please retry.");
    return {success:true,message:"신청이 접수되었습니다. 참가 확정과 납부 안내는 확인 후 보내드립니다. / Application received. Confirmation and payment instructions will follow after review."};
  }catch{return fail("서버에 연결하지 못했습니다. 다시 시도해주세요. / Connection failed. Please retry.");}
}
