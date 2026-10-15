import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicPages, publicPath, type PublicLocale } from "@/lib/public-content";
export function PublicDetail({slug,locale="ko"}:{slug:string;locale?:PublicLocale}) {
  const page=getPublicPages(locale).find(p=>p.slug===slug);
  if(!page)notFound();
  const en=locale==="en";
  return <main id="public-main" className="public-detail" tabIndex={-1}><Link className="public-text-link" href={publicPath(locale)}>{en?"← Back to home":"← 홈으로"}</Link><div className="public-detail-heading"><span className="public-kicker">{page.title}</span><h1>{page.intro}</h1><p>{page.description}</p></div><section className="public-detail-empty" aria-labelledby="empty-title"><span className="public-tag">{en?"Coming soon":"준비 중"}</span><h2 id="empty-title">{en?"More details are on the way":"조금만 기다려주세요"}</h2><p>{page.empty}</p><Link className="public-button" href={publicPath(locale)}>{en?"Back to home":"홈으로 돌아가기"}</Link></section></main>;
}
