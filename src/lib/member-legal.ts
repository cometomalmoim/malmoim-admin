export type LegalText={ko:string;en:string};
export type MemberLegalDocument={version:string;effectiveDate:string;sections:{id:string;title:LegalText;paragraphs:{ko:string[];en:string[]}}[]};
export type MemberLegalPublication={
 privacy:MemberLegalDocument;terms:MemberLegalDocument;
 collection:{version:string;basis:"consent"|"contract";purpose:LegalText;items:LegalText;retention:LegalText;refusal:LegalText};
};
// Publish only after the operator/contact/retention/processors/transfers and terms
// are approved. Internal bilingual drafts live in docs, never in public bundles.
// No environment/browser switch can turn an incomplete legal draft into a policy.
export const publishedMemberLegal:MemberLegalPublication|null=null;
