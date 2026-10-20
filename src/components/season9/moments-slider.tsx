'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import {reviewSlideIndex} from '@/lib/review-carousel';
import { publicEventReviews } from '@/app/actions/event-reviews';
import type { PublicEventReview } from '@/lib/review-validation';

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
 const [reviews,setReviews]=useState<PublicEventReview[]>([]);
 useEffect(()=>{let active=true;void publicEventReviews('season9').then(rows=>{if(active)setReviews(rows);});return()=>{active=false;};},[]);
 const slides=reviews.length?reviews.map(row=>({language:row.locale==='en'?'English':'한국어',text:row.body,name:row.display_name})):moments.map(row=>({...row,name:''}));
 const [index, setIndex] = useState(0);
 const currentIndex=index%slides.length;
 const current=slides[currentIndex];
 const [paused, setPaused] = useState(false);
 const [timerRevision,setTimerRevision]=useState(0);
 const reduced = useSyncExternalStore(subscribeMotion, reducedMotion, () => true);
 useEffect(() => {
  if (paused || reduced || slides.length<2) return;
  const interval = setInterval(() => setIndex(value => reviewSlideIndex(value,1,slides.length)), 6500);
  return () => clearInterval(interval);
 }, [paused, reduced, slides.length,timerRevision]);
 const move = (step: number) => { setIndex(value => reviewSlideIndex(value,step,slides.length));setTimerRevision(value=>value+1); };
 return <div className="s9-moment-slider" role="region" aria-roledescription="carousel" aria-label={reviews.length?(english?'Participant reviews':'참여자 후기'):(english ? 'Moments to look forward to' : '말모임에서 기대할 수 있는 순간들')}>
  <div><span className="s9-kicker">{reviews.length?(english?"REVIEWS":"참여자 후기"):(english ? "ABOUT MALMOIM" : "말모임 이야기")}</span><h3>{reviews.length?(english?'From our participants':'참여자들이 전하는 이야기'):(english ? 'Learning from each other' : '서로 배우는 시간')}</h3><p>{reviews.length?(english?'Shared with permission.':'게시 동의를 받은 후기입니다.'):(english ? 'A few things about our gatherings.' : '말모임이 어떤 모임인지 짧게 소개할게요.')}</p></div>
  <div className="s9-moment-window" aria-live={paused?'polite':'off'}><article key={`${reviews.length?'review':'intro'}-${currentIndex}`} lang={current.language==='English'?'en':'ko'}><span>{current.language}</span><p>{current.text}</p>{current.name&&<strong className="s9-review-name">{current.name}</strong>}</article><div className="s9-moment-controls"><button type="button" aria-label={english ? 'Previous review' : '이전 후기'} disabled={slides.length<2} onClick={() => move(-1)}>←</button><span aria-label={english ? `Slide ${currentIndex + 1} of ${slides.length}` : `${slides.length}개 중 ${currentIndex + 1}번째`}>{String(currentIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2,'0')}</span><button type="button" aria-label={english ? 'Next review' : '다음 후기'} disabled={slides.length<2} onClick={() => move(1)}>→</button>{!reduced && slides.length>1 && <button type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{english ? (paused ? 'Play' : 'Pause') : (paused ? '자동 넘김 재생' : '자동 넘김 멈춤')}</button>}</div></div>
 </div>;
}
