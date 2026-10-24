import type {MemberLegalPublication} from "./member-legal";
import type {RegistrationPolicy} from "./member-registration";

export function registrationDocumentsReady(policy:RegistrationPolicy|null,legal:MemberLegalPublication|null){
 // Validate displayed versions; dates are metadata, not an activation switch.
 return !!policy&&!!legal&&
  policy.termsVersion===legal.terms.version&&policy.privacyVersion===legal.privacy.version&&
  policy.consentVersion===legal.collection.version&&policy.privacyConsentRequired===(legal.collection.basis==="consent");
}
export function registrationDatabaseReady(value:unknown,policy:RegistrationPolicy){
 if(!value||typeof value!=="object")return false;
 const ready=value as Record<string,unknown>;
 return ready.enabled===true&&
  ready.terms_version===policy.termsVersion&&ready.privacy_version===policy.privacyVersion&&
  ready.collection_version===policy.consentVersion&&ready.requires_consent===policy.privacyConsentRequired;
}
