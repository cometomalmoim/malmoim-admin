export const smsPurposes={payment:'입금',selection:'선발·확정',refund:'환불',event:'행사 안내',receipt:'신청 접수',direct:'직접 작성'} as const;
export type SmsPurpose=keyof typeof smsPurposes;
export function smsTemplatePurpose(template:{category:string;title:string}):SmsPurpose{
 const title=template.title??'';
 if(template.category==='receipt')return 'receipt';
 if(/환불|refund/i.test(title))return 'refund';
 if(template.category==='payment'||/입금|payment.*(request|received|confirmed)/i.test(title))return 'payment';
 if(template.category==='confirmation'||/합격|불합격|선발|대기|참가.*확정|selected|accepted|declined|waitlist|final.*confirm/i.test(title))return 'selection';
 if(template.category==='reminder'||/이벤트|행사.*안내|리마인드|event.*(notice|detail)|reminder/i.test(title))return 'event';
 return 'direct';
}
