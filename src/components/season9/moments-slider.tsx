'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';

// Replace with organizer-approved real feedback later; these are program descriptions, not testimonials.
const moments = [
 { language: '한국어', text: '혼자 신청해도 괜찮아요. 소그룹에서 서로의 언어를 배우며 새로운 친구들과 대화를 시작해요.' },
 { language: 'English', text: 'Come on your own and meet new friends through English conversation, Korean learning, and shared cultural activities.' },
 { language: '한국어', text: '영어 대화 45분, 한국어 배우기 45분, 함께하는 활동 40분. 한 번의 모임에서 다양한 교류를 경험해요.' },
 { language: 'English', text: 'Communication comes before fluency. Learn from each other, share your culture, and take part at your own language level.' },
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
  <div><span className="s9-kicker">MOMENTS TO LOOK FORWARD TO</span><h3>{english ? 'A little conversation. A new connection.' : '작은 대화가 새로운 인연으로.'}</h3><p>{english ? 'Discover what MALMOIM is about.' : '말모임에서 함께할 순간들을 만나보세요.'}</p></div>
  <div className="s9-moment-window"><article key={index} lang={index % 2 ? 'en' : 'ko'}><span>{moments[index].language}</span><p>{moments[index].text}</p></article><div className="s9-moment-controls"><button type="button" aria-label={english ? 'Previous introduction' : '이전 소개'} onClick={() => move(-1)}>←</button><span aria-label={english ? `Slide ${index + 1} of ${moments.length}` : `${moments.length}개 중 ${index + 1}번째`}>{String(index + 1).padStart(2, '0')} / 04</span><button type="button" aria-label={english ? 'Next introduction' : '다음 소개'} onClick={() => move(1)}>→</button>{!reduced && <button type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{english ? (paused ? 'Play' : 'Pause') : (paused ? '자동 넘김 재생' : '자동 넘김 멈춤')}</button>}</div></div>
 </div>;
}
