export function season9SmsSchedule(group:string|null|undefined){
 if(group==='thursday')return {start:'2026-11-05T18:30:00+09:00',end:'2026-11-05T21:00:00+09:00'};
 if(group==='saturday')return {start:'2026-11-07T13:00:00+09:00',end:'2026-11-07T15:30:00+09:00'};
 return {start:null,end:null};
}
export function automaticClassBody(body:string){
 return body.replace(/(?:목요일반|토요일반) · 매주 [^\n]+\n첫 모임: [^\n]+/g,'{행사일} {시작시간} ~ {종료시간} (한국 시간)').replace(/(?:Thursday|Saturday) class · Every [^\n]+\nFirst session: [^\n]+/g,'{행사일} {시작시간} – {종료시간} (KST)');
}
export function copiedClassTemplate(title:string){return /^(목요일반|토요일반|Thursday class|Saturday class) · /.test(title);}
