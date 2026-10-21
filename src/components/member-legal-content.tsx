import type { MemberLegalDocument } from "@/lib/member-legal";
import type { PublicLocale } from "@/lib/public-content";
import "./member-legal.css";

// Shared by the standalone page and the signup dialog. Only approved publication
// data reaches this renderer; internal drafts are never imported into public UI.
export function MemberLegalContent({ document, locale, idPrefix = "", kind = "privacy" }: {
  document: MemberLegalDocument | null; locale: PublicLocale; idPrefix?: string; kind?: "privacy" | "terms";
}) {
  const en = locale === "en";
  if (!document) return <div className="member-legal-content member-legal-pending">
    <h2>{en ? "Publication is being prepared" : kind === "privacy" ? "개인정보 처리방침 공개 준비 중" : "이용약관 공개 준비 중"}</h2>
    <p>{en ? "The document is being reviewed. The full text will be available here once approved."
      : "문서를 검토하고 있습니다. 승인이 완료되면 이곳에서 전문을 확인할 수 있습니다."}</p>
  </div>;
  return <div className="member-legal-content">
    <p className="member-legal-date">{en ? "Effective date" : "시행일"}: <time dateTime={document.effectiveDate}>{document.effectiveDate}</time> · {document.version}</p>
    <nav aria-label={en ? "Document contents" : "문서 목차"}><ol>{document.sections.map(section =>
      <li key={section.id}><a href={"#" + idPrefix + section.id}>{section.title[locale]}</a></li>)}</ol></nav>
    {document.sections.map(section => <section id={idPrefix + section.id} key={section.id}>
      <h2>{section.title[locale]}</h2>
      {section.paragraphs[locale].map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    </section>)}
  </div>;
}
