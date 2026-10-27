import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicPages, publicPath, type PublicLocale } from "./public-content";
export function publicMetadata(locale:PublicLocale,slug=""):Metadata {
  const page=slug?getPublicPages(locale).find(p=>p.slug===slug):undefined;
  if(slug&&!page)notFound();
  const title=page?.title??(locale==="en"?"MALMOIM":"말모임 MALMOIM");
  const description=page?.description??(locale==="en"?"Words bring us together. Friendships connect our worlds. Meet MALMOIM, a community sharing languages, cultures, and experiences.":"말로 이어지는 세계, 마음으로 연결되는 사람들. 한국인과 외국인이 함께 언어와 문화를 나누는 말모임의 정규 세션과 다양한 활동을 만나보세요.");
  return {title:slug?title:{absolute:title},description,alternates:{canonical:publicPath(locale,slug),languages:{ko:publicPath("ko",slug),en:publicPath("en",slug),"x-default":publicPath("ko",slug)}},openGraph:{title,description,locale:locale==="en"?"en_US":"ko_KR",url:publicPath(locale,slug),...(!slug?{images:[{url:"/home/moments/hero-group.webp",width:1600,height:1159,alt:locale==="en"?"MALMOIM participants posing together":"함께 기념사진을 찍는 말모임 참여자들"}]}:{})}};
}
