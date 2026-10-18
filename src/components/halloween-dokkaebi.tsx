import {useId}from 'react';
export function HalloweenDokkaebi({english=false}:{english?:boolean}){
 const glow=useId(),skin=useId();
 return <svg className="hw-dokkaebi" viewBox="0 0 360 310" role="img" aria-label={english?'Halloween goblin with horns and glowing eyes':'뿔과 빛나는 눈을 가진 할로윈 도깨비'}>
  <defs><radialGradient id={glow}><stop stopColor="#d96821" stopOpacity=".45"/><stop offset="1" stopColor="#d96821" stopOpacity="0"/></radialGradient><linearGradient id={skin} x2="0" y2="1"><stop stopColor="#a35039"/><stop offset="1" stopColor="#47242a"/></linearGradient></defs>
  <ellipse cx="180" cy="166" rx="176" ry="143" fill={`url(#${glow})`}/>
  <g className="hw-dokkaebi-head" stroke="#20131c" strokeWidth="5" strokeLinejoin="round">
   <path d="M101 104Q57 49 84 8q8 44 58 62M259 104q44-55 17-96-8 44-58 62" fill="#dfc5a0"/>
   <path d="m94 113-32-8 16 45-19 24 38 12m169-73 32-8-16 45 19 24-38 12" fill="#79372f"/>
   <path d="M91 118Q95 57 180 62q85-5 89 56l-7 91q-20 61-82 72-62-11-82-72Z" fill={`url(#${skin})`}/>
   <path d="m106 117 49 18-41 5m140-23-49 18 41 5" fill="#1c1621"/>
   <path className="hw-dokkaebi-eyes" d="m113 145 41 5-19 15-24-7m136-13-41 5 19 15 24-7" fill="#ffc762" stroke="#c17430" strokeWidth="2"/>
   <path d="m178 143-13 43 15 8 17-8-15-43" fill="#552327" strokeWidth="3"/>
   <path className="hw-dokkaebi-mouth" d="M122 213q58 50 116 0l-12 34q-46 28-92-1Z" fill="#160f1b"/>
   <path d="m130 215 5 33 13-24m81-9-5 33-13-24" fill="#f5dfbd" strokeWidth="2"/>
   <path d="m110 175 28 12m112-12-28 12m-63-91 21 11 21-11" stroke="#c47751" strokeWidth="3" fill="none"/>
  </g>
 </svg>;
}
