export const smsStates:Record<string,string>={draft:'발송 전 확인',queued:'발송 대기',dispatching:'발송 요청 중',accepted:'발송 완료 · 도달 확인 중',delivered:'발송 완료 · 도달 성공',failed:'발송 실패',unknown:'결과 불명 · 재발송 금지',cancelled:'취소'};
export function domesticPhone(value:string):string|null {
 let n=value.trim().replace(/[ ()-]/g,'');
 if(n.startsWith('+82'))n='0'+n.slice(3);else if(n.startsWith('0082'))n='0'+n.slice(4);
 return /^(?:010\d{8}|01[16789]\d{7,8})$/.test(n)?n:null;
}
export function validSmsText(text:string){return !!text.trim()&&new TextEncoder().encode(text).length<=2000&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)&&!/[{}]/.test(text);}
export const smsUuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export type SmsPrepared={id:string;count:number;total:number;unit:number;type:'LMS'|'SMS';sample:string;sender:string;recipient:string;items:{to:string;text:string}[]};
