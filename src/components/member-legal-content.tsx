import type { LegalBlock,MemberLegalDocument } from "@/lib/member-legal";
import type { PublicLocale } from "@/lib/public-content";
import "./member-legal.css";

function Inline({text}:{text:string}){
 return <>{text.split(/(\*\*[^*]+\*\*)/g).map((part,index)=>part.startsWith("**")&&part.endsWith("**")?<strong key={index}>{part.slice(2,-2)}</strong>:part)}</>;
}
function Blocks({blocks,locale}:{blocks:LegalBlock[];locale:PublicLocale}){
 return <>{blocks.map((block,index)=>{
  if(block.type==="paragraph")return <p key={index}><Inline text={block.text}/></p>;
  if(block.type==="subheading")return <h3 key={index}><Inline text={block.text}/></h3>;
  if(block.type==="list"){
   const items=block.items.map((item,i)=><li key={i} value={item.number}><Inline text={item.text}/></li>);
   return block.ordered?<ol key={index} start={block.items[0]?.number}>{items}</ol>:<ul key={index}>{items}</ul>;
  }
  if(block.type!=="table")return null;
  return <div key={index} className="member-legal-table-scroll" role="region" tabIndex={0} aria-label={locale==="en"?"Document table":"문서 표"}><table><thead><tr>{block.headers.map((cell,i)=><th key={i} scope="col"><Inline text={cell}/></th>)}</tr></thead><tbody>{block.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}><Inline text={cell}/></td>)}</tr>)}</tbody></table></div>;
 })}</>;
}

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
    <p className="member-legal-date">{en ? "Effective date" : "시행일"}: {document.effectiveDate?<time dateTime={document.effectiveDate}>{document.effectiveDate}</time>:(en?"Not yet set":"미정")} · {document.version}</p>
    {document.introduction&&<Blocks blocks={document.introduction[locale]} locale={locale}/>}
    <nav aria-label={en ? "Document contents" : "문서 목차"}><ol>{document.sections.map(section =>
      <li key={section.id}><a href={"#" + idPrefix + section.id}>{section.title[locale]}</a></li>)}</ol></nav>
    {document.sections.map(section => <section id={idPrefix + section.id} key={section.id}>
      <h2>{section.title[locale]}</h2>
      {section.blocks?<Blocks blocks={section.blocks[locale]} locale={locale}/>:section.paragraphs[locale].map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    </section>)}
  </div>;
}
