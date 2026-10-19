'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';

// Replace with organizer-approved real feedback later; these are program descriptions, not testimonials.
const moments = [
 { language: '한국어', text: '소그룹으로 모여 활동지를 보며 영어와 한국어로 이야기해요. 서로 배우고 알려주는 시간이에요.' },
 { language: 'English', text: 'Korean and international participants take turns helping each other practise in small groups.' },
 { language: '한국어', text: '유창하게 말하지 않아도 괜찮아요. 완벽한 문장보다는 함께 대화해보는 데 의미를 두고 있어요.' },
 { language: 'English', text: 'We start conversations with activity sheets and spend time together on cultural group activities.' },
];
function subscribeMotion(listener: () => void) { const media = window.matchMedia('(prefers-reduced-motion: reduce)'); media.addEventListener('change', listener); return () => media.removeEventListener('change', listener); }
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export function MomentsSlider({ english = false }: { english?: boolean }) {
 const [index, setIndex] = useState(0);
 const [paused, setPaused] = useState(false);
 const [engaged, setEngaged] = useState(false);
 const reduced = useSyncExternalStore(subscribeMotion, reducedMotion, () => true);
 useEffect(() => {
  if (paused || engaged || reduced) return;
  const interval = setInterval(() => setIndex(value => (value + 1) % moments.length), 6500);
  return () => clearInterval(interval);
 }, [paused, engaged, reduced]);
 const move = (step: number) => { setPaused(true); setIndex(value => (value + step + moments.length) % moments.length); };
 return <div className="s9-moment-slider" role="region" aria-roledescription="carousel" aria-label={english ? 'Moments to look forward to' : '말모임에서 기대할 수 있는 순간들'} onMouseEnter={() => setEngaged(true)} onMouseLeave={() => setEngaged(false)} onFocus={() => setEngaged(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setEngaged(false); }}>
  <div><span className="s9-kicker">{english ? "ABOUT MALMOIM" : "말모임 이야기"}</span><h3>{english ? 'Learning from each other' : '서로 배우는 시간'}</h3><p>{english ? 'A few things about our gatherings.' : '말모임이 어떤 모임인지 짧게 소개할게요.'}</p></div>
  <div className="s9-moment-window"><article key={index} lang={index % 2 ? 'en' : 'ko'}><span>{moments[index].language}</span><p>{moments[index].text}</p></article><div className="s9-moment-controls"><button type="button" aria-label={english ? 'Previous introduction' : '이전 소개'} onClick={() => move(-1)}>←</button><span aria-label={english ? `Slide ${index + 1} of ${moments.length}` : `${moments.length}개 중 ${index + 1}번째`}>{String(index + 1).padStart(2, '0')} / 04</span><button type="button" aria-label={english ? 'Next introduction' : '다음 소개'} onClick={() => move(1)}>→</button>{!reduced && <button type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{english ? (paused ? 'Play' : 'Pause') : (paused ? '자동 넘김 재생' : '자동 넘김 멈춤')}</button>}</div></div>
 </div>;
}
