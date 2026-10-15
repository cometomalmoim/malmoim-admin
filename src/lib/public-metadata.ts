import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicPages, publicPath, type PublicLocale } from "./public-content";
export function publicMetadata(locale:PublicLocale,slug=""):Metadata {
  const page=slug?getPublicPages(locale).find(p=>p.slug===slug):undefined;
  if(slug&&!page)notFound();
  const title=page?.title??(locale==="en"?"MALMOIM":"말모임 MALMOIM");
  const description=page?.description??(locale==="en"?"Get to know MALMOIM, explore studies and events, one-to-one language exchange, and stories from past activities.":"말모임 소개, 스터디·이벤트, 1:1 언어교환과 지난 활동 안내를 만나보세요.");
  return {title:slug?title:{absolute:title},description,alternates:{canonical:publicPath(locale,slug),languages:{ko:publicPath("ko",slug),en:publicPath("en",slug),"x-default":publicPath("ko",slug)}},openGraph:{title,description,locale:locale==="en"?"en_US":"ko_KR",url:publicPath(locale,slug)}};
}
