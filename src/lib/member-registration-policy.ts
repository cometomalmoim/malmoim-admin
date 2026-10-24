import {memberRegistrationRelease} from "./member-registration-release";
import "server-only";
import type {RegistrationPolicy} from "./member-registration";
import {publishedMemberLegal} from "./member-legal";
import {SIGNUP_RULES} from "./signup-options";

// Availability is technical; document dates do not enable or disable signup.
export const memberRegistrationPolicy:RegistrationPolicy|null = publishedMemberLegal&&memberRegistrationRelease.registrationEnabled?{
 minPasswordLength:SIGNUP_RULES.minPasswordLength,requiredFields:["birthDate"],
 consentVersion:publishedMemberLegal.collection.version,
 termsVersion:publishedMemberLegal.terms.version,privacyVersion:publishedMemberLegal.privacy.version,
 privacyConsentRequired:publishedMemberLegal.collection.basis==="consent",collectOptionalProfile:false,persistBeforeConfirmation:true,
}:null;
