'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { homePrograms, homeWords, isHomeProgramOpen } from '@/lib/public-home-content';
import { publicPath, type PublicLocale } from '@/lib/public-content';
function subscribe(callback: () => void) {
  const timer = window.setInterval(callback, 60_000);
  window.addEventListener('focus', callback);
  return () => { window.clearInterval(timer); window.removeEventListener('focus', callback); };
}
function Program({ program, locale }: { program: typeof homePrograms[number]; locale: PublicLocale }) {
  const en = locale === 'en';
  const open = useSyncExternalStore(subscribe, () => isHomeProgramOpen(program, Date.now()), () => false);
  return <article className="mh-program"><div className="mh-program-photo"><Image src={program.image.src} width={program.image.width} height={program.image.height} alt={homeWords(program.image.alt, locale)} sizes="(max-width: 760px) 90vw, 480px" /></div><div className="mh-program-body"><span className="mh-status">{open ? (en ? 'Applications open' : '모집 중') : (en ? 'Program details' : '프로그램 안내')}</span><h3>{homeWords(program.title, locale)}</h3><p>{homeWords(program.description, locale)}</p><ul className="mh-program-facts"><li>{homeWords(program.duration, locale)}</li><li>{en ? 'KRW ' : '참가비 '}{program.fee.toLocaleString('en-US')}{en ? '' : '원'}</li></ul><Link className="mh-button" prefetch={false} href={program.href[locale]}>{en ? 'View program' : '자세히 보기'} <span aria-hidden="true">↗</span></Link></div></article>;
}
export function PublicHomePrograms({ locale }: { locale: PublicLocale }) {
  const programs = homePrograms.filter(program => program.visible);
  return programs.length ? <>{programs.map(program => <Program key={program.id} program={program} locale={locale} />)}</> : <p><Link className="mh-link" href={publicPath(locale, 'events')}>{locale === 'en' ? 'See studies & events →' : '스터디·이벤트 확인하기 →'}</Link></p>;
}
