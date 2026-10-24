import {memberRegistrationRelease} from "./member-registration-release";
import {memberLegalDocuments} from "./member-legal-documents";
export type LegalText={ko:string;en:string};
export type MemberLegalKind="privacy"|"terms";
export type LegalBlock=
 | {type:"paragraph"|"subheading";text:string}
 | {type:"list";ordered:boolean;items:{text:string;number?:number}[]}
 | {type:"table";headers:string[];rows:string[][]};
export type MemberLegalDocument={version:string;effectiveDate:string|null;title?:LegalText;introduction?:{ko:LegalBlock[];en:LegalBlock[]};sections:{id:string;title:LegalText;paragraphs:{ko:string[];en:string[]};blocks?:{ko:LegalBlock[];en:LegalBlock[]}}[]};
export type MemberLegalDocuments=Record<MemberLegalKind,MemberLegalDocument|null>;
export type MemberDocumentPublication={published:boolean;document:MemberLegalDocument|null};
// The operator requested publication of the supplied documents with signup.
// Publishing a snapshot does not infer an effective date or a legal approval.
// Originals and internal annotations remain in docs, outside public bundles.
export const memberDocumentPublications:Record<MemberLegalKind,MemberDocumentPublication>={
 privacy:{published:memberRegistrationRelease.registrationEnabled,document:memberLegalDocuments.privacy},
 terms:{published:memberRegistrationRelease.registrationEnabled,document:memberLegalDocuments.terms},
};
export function getPublishedMemberDocument(kind:MemberLegalKind,publication=memberDocumentPublications[kind]):MemberLegalDocument|null{
 const doc=publication.document;
 if(!publication.published||!doc||!doc.version.trim())return null;
 if(doc.effectiveDate!==null){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(doc.effectiveDate))return null;
  const date=new Date(doc.effectiveDate+"T00:00:00Z");
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==doc.effectiveDate)return null;
 }
 if(/TODO|운영 확인 필요|최종 승인 후 기재|Operational verification required|To be entered after final approval/i.test(JSON.stringify(doc)))return null;
 return doc;
}
export type MemberLegalPublication={
 privacy:MemberLegalDocument;terms:MemberLegalDocument;
 collection:{version:string;basis:"consent"|"contract";purpose:LegalText;items:LegalText;retention:LegalText;refusal:LegalText};
};
const privacy=getPublishedMemberDocument("privacy"),terms=getPublishedMemberDocument("terms");
// Required signup fields only. Unspecified optional purposes are not invented.
export const memberLegalCandidate:MemberLegalPublication={
 privacy:memberLegalDocuments.privacy,terms:memberLegalDocuments.terms,collection:{version:memberRegistrationRelease.collectionVersion,basis:"contract",
 purpose:{ko:"회원가입 및 계정 관리, 만 19세 이상 가입 자격 확인, 커뮤니티 내 회원 식별 및 작성자 표시, 한국어·영어 언어교환 서비스 제공",en:"Registration and account management, eligibility checks for ages 19 and over, member identification and author display in the community, and Korean–English language exchange services"},
 items:{ko:"이메일 주소, 비밀번호, 닉네임, 생년월일, 한국어 수준, 영어 수준",en:"Email address, password, nickname, date of birth, Korean proficiency, and English proficiency"},
 retention:{ko:"회원 탈퇴 시까지. 법령상 보존 의무가 있는 정보는 개인정보 처리방침 제3조에 따라 별도 보관합니다.",en:"Until membership withdrawal. Information subject to statutory retention is stored separately as described in Article 3 of the Privacy Policy."},
 refusal:{ko:"필수 항목을 제공하지 않으면 회원가입을 진행할 수 없습니다. 현재 가입 화면에서는 선택 개인정보를 수집하지 않습니다.",en:"Registration cannot proceed without the required information. Optional personal information is not collected on the current signup form."},
 },
};
export const publishedMemberLegal:MemberLegalPublication|null=privacy&&terms?{...memberLegalCandidate,privacy,terms}:null;
