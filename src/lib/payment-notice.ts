export type PaymentNotice = 'paid' | 'refunded';
export function changedPaymentNotice(previous:string,next:string):PaymentNotice|null {
 return previous!==next&&(next==='paid'||next==='refunded')?next:null;
}
export function paymentNoticeTemplate(template:{category:string;title:string},status:string){
 return (status==='accepted'&&template.category==='confirmation') || (template.category==='custom'&&/입금\s*확인|입금\s*완료|payment\s*(received|confirmed)/i.test(template.title));
}
export const paymentReceivedExamples = [
 {category:'custom' as const,language:'ko' as const,title:'입금 확인 안내',body:'{이름}님, {행사명} 참가비 입금을 확인했습니다. 감사합니다.\n참가 확정 및 행사 안내는 별도로 안내드리겠습니다.'},
 {category:'custom' as const,language:'en' as const,title:'Payment received',body:'Hi {이름}, we have confirmed your payment for {행사명}. Thank you!\nParticipation confirmation and event details will be provided separately.'},
];

export function refundNoticeTemplate(template:{category:string;title:string}){return template.category==='custom'&&/환불.*완료|refund.*(completed|processed)/i.test(template.title);}
export const refundCompletedExamples=[
 {category:'custom' as const,language:'ko' as const,title:'환불 완료 안내',body:'{이름}님, {행사명} 참가비 환불을 완료했습니다. 문의가 있으시면 운영진에게 연락해주세요. 감사합니다.'},
 {category:'custom' as const,language:'en' as const,title:'Refund completed',body:'Hi {이름}, your refund for {행사명} has been completed. Please contact the organizers if you have any questions. Thank you.'},
];
