"use client";
import {useCallback,useState} from "react";
import type {MemberLegalPublication,MemberLegalDocuments} from "@/lib/member-legal";
import type {PublicLocale} from "@/lib/public-content";
import {MemberLegalModal} from "./member-legal-modal";

export function SignupLegalNotice({legal,enabled,locale,errors,pending=false,documents={privacy:legal?.privacy??null,terms:legal?.terms??null}}:{legal:MemberLegalPublication|null;enabled:boolean;locale:PublicLocale;errors:Record<string,string>;pending?:boolean;documents?:MemberLegalDocuments}){
 const en=locale==="en",active=!!legal&&enabled;
 const [opened,setOpened]=useState<"privacy"|"terms"|null>(null);
 const closeModal=useCallback(()=>setOpened(null),[]);
 return <section className="signup-consent" aria-labelledby="signup-consent-title">
  <h2 id="signup-consent-title">{en?"Terms and privacy information":"이용약관 및 개인정보 안내"}</h2>
  <label className="signup-consent-label"><input type="checkbox" id="termsConsent" name="termsConsent" disabled={!active||pending} required={active} aria-invalid={!!errors.termsConsent} aria-describedby={errors.termsConsent?"termsConsent-error":undefined}/>{en?"I agree to the Terms of Service (required)":"이용약관 동의 (필수)"}</label>
  {errors.termsConsent&&<p id="termsConsent-error" className="signup-error">{errors.termsConsent}</p>}
  <div className="signup-document-links">
   <button type="button" className="signup-policy-link" aria-haspopup="dialog" onClick={()=>setOpened("terms")}>{en?"Read full Terms of Service":"이용약관 전문 보기"}</button>
   <button type="button" className="signup-policy-link" aria-haspopup="dialog" onClick={()=>setOpened("privacy")}>{en?"Read full Privacy Policy":"개인정보 처리방침 전문 보기"}</button>
  </div>
  {legal&&<><h3>{en?"Personal information collection and use":"개인정보 수집·이용 안내"}</h3><dl>{([["Purpose","목적","purpose"],["Information","항목","items"],["Retention","보유기간","retention"],["Refusal and effect","거부권 및 영향","refusal"]] as const).map(([english,korean,key])=><div key={key}><dt>{en?english:korean}</dt><dd>{legal.collection[key][locale]}</dd></div>)}</dl>
   {legal.collection.basis==="consent"?<label className="signup-consent-label"><input type="checkbox" id="privacyConsent" name="privacyConsent" disabled={!active||pending} required={active} aria-invalid={!!errors.privacyConsent} aria-describedby={errors.privacyConsent?"privacyConsent-error":undefined}/>{en?"I consent to the collection and use described above (required)":"위 개인정보 수집·이용에 동의합니다 (필수)"}</label>:<p>{en?"The information above is processed for entering into and performing the service agreement, rather than on the basis of a privacy consent checkbox.":"위 항목은 서비스 계약 체결·이행을 위한 처리로 안내하며, 개인정보 동의 체크박스를 근거로 처리하지 않습니다."}</p>}
   {errors.privacyConsent&&<p id="privacyConsent-error" className="signup-error">{errors.privacyConsent}</p>}
   <input type="hidden" name="termsVersion" value={legal.terms.version}/><input type="hidden" name="privacyVersion" value={legal.privacy.version}/><input type="hidden" name="collectionVersion" value={legal.collection.version}/>
  </>}
  <MemberLegalModal open={opened!==null} onClose={closeModal} document={opened==="terms"?documents.terms:documents.privacy} locale={locale} kind={opened??"privacy"}/>
 </section>;
}
