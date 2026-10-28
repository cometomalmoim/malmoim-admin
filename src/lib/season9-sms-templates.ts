import {smsStarterTemplates} from './bulk-sms';
export function season9ClassSmsTemplates(event:string){
 return (['ko','en'] as const).flatMap(language=>(['thursday','saturday'] as const).flatMap(group=>{
  const thu=group==='thursday';const label=language==='ko'?(thu?'목요일반':'토요일반'):(thu?'Thursday class':'Saturday class');
  const schedule=language==='ko'?`${label} · 매주 ${thu?'목요일 18:30–21:00':'토요일 13:00–15:30'} (한국 시간)\n첫 모임: 2026년 11월 ${thu?'5일 (목)':'7일 (토)'}`:`${label} · Every ${thu?'Thursday, 6:30–9:00 PM':'Saturday, 1:00–3:30 PM'} (KST)\nFirst session: November ${thu?'5 (Thu)':'7 (Sat)'}, 2026`;
  return smsStarterTemplates(event,language).filter(template=>['starter:accepted:','starter:confirmation:','starter:event:','starter:reminder:'].some(prefix=>template.id.startsWith(prefix))).map(template=>({...template,id:`season9:${group}:${template.id}`,title:`${label} · ${template.title}`,body:template.body.replace(language==='ko'?'{행사일} {시작시간} (한국 시간)':'{행사일} {시작시간} (KST)',schedule)}));
 }));
}
