export type PaymentNotice = 'paid' | 'refunded';
export function changedPaymentNotice(previous:string,next:string):PaymentNotice|null {
 return previous!==next&&(next==='paid'||next==='refunded')?next:null;
}
export function paymentNoticeTemplate(template:{category:string;title:string},status:string){
 return (status==='accepted'&&template.category==='confirmation') || (template.category==='custom'&&/입금\s*확인|입금\s*완료|payment\s*(received|confirmed)/i.test(template.title));
}
export const paymentReceivedExamples = [
 {category:'custom' as const,language:'ko' as const,title:'입금 확인 안내',body:"안녕하세요, 말모임 운영진입니다.\n\n{이름}님, {행사명} 참가비 입금이 확인되었어요. 함께해주셔서 감사합니다.\n참가 확정과 자세한 행사 소식은 별도로 안내드릴게요."},
 {category:'custom' as const,language:'en' as const,title:'Payment received',body:"Hello, this is the MALMOIM team.\n\nHi {이름}, your payment for {행사명} has been confirmed. Thank you for joining us! Final participation details will follow separately."},
];

export function refundNoticeTemplate(template:{category:string;title:string}){return template.category==='custom'&&/환불.*완료|refund.*(completed|processed)/i.test(template.title);}
export const refundCompletedExamples=[
 {category:'custom' as const,language:'ko' as const,title:'환불 완료 안내',body:"안녕하세요, 말모임 운영진입니다.\n\n{이름}님, {행사명} 참가비 환불이 완료되어 안내드립니다.\n이번에는 함께하지 못해 아쉽지만, 다음에 좋은 기회로 다시 만나요. 감사합니다."},
 {category:'custom' as const,language:'en' as const,title:'Refund completed',body:"Hello, this is the MALMOIM team.\n\nHi {이름}, your refund for {행사명} has been completed. We are sorry we will not see you this time, and hope to meet you at another event. Thank you!"},
];
