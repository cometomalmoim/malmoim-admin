export type SmsPreparationCode='draft'|'other_draft'|'unknown'|'awaiting_delivery'|'in_progress'|'recipient_changed'|'template_changed'|'payment_required'|'resend_required'|'invalid_event'|'invalid_text'|'forbidden'|'unavailable';
export function smsPreparationIssue(raw:string,blocking?:{state:string;own:boolean}[]):{code:SmsPreparationCode;message:string}{
 if(raw.includes('pending_or_unknown')){
  if(blocking?.some(j=>j.state==='unknown'))return {code:'unknown',message:'기존 문자의 결과가 불명입니다. 발송 기록과 업체 내역을 확인하기 전에는 다시 보내지 않습니다.'};
  if(blocking?.some(j=>j.state==='accepted'))return {code:'awaiting_delivery',message:'기존 문자가 업체에 접수되어 도달 결과를 기다리는 중입니다. 기존 발송 결과를 먼저 조회해주세요.'};
  if(blocking?.some(j=>['queued','dispatching'].includes(j.state)))return {code:'in_progress',message:'기존 문자가 발송 대기 또는 처리 중입니다. 중복 발송하지 않고 기존 처리가 끝나기를 기다립니다.'};
  if(blocking?.some(j=>j.state==='draft'&&!j.own))return {code:'other_draft',message:'다른 운영진의 미발송 초안이 남아 있습니다. 담당 운영진이 초안을 취소하거나 10분 만료 후 다시 준비해주세요.'};
  if(blocking?.some(j=>j.state==='draft'&&j.own))return {code:'draft',message:'내 미발송 초안이 남아 있습니다. 초안을 취소한 뒤 새 내용과 비용을 다시 준비할 수 있습니다.'};
  return {code:'unavailable',message:'기존 문자 처리 상태가 바뀌었거나 조회되지 않았습니다. 발송 기록을 확인한 뒤 다시 준비해주세요.'};
 }
 const known:[string,SmsPreparationCode,string][]=[['recipient_changed','recipient_changed','신청자 정보가 변경되었거나 삭제되었습니다. 최신 신청자 상태로 다시 준비해주세요.'],['template_changed','template_changed','선택한 문구가 수정되거나 비활성화되었습니다. 최신 문구를 다시 선택해주세요.'],['payment_required','payment_required','최종 확정 문자는 합격·입금 완료인 신청자에게만 보낼 수 있습니다.'],['resend_confirmation_required','resend_required','이 신청자에게 도달 성공한 문자가 있습니다. 기존 기록 확인 후 재발송 옵션을 선택해주세요.'],['invalid_event','invalid_event','테스트 이벤트 또는 삭제된 이벤트에서는 문자를 준비할 수 없습니다.'],['invalid_text','invalid_text','본문의 미입력 변수와 SMS/LMS 길이를 확인해주세요.'],['forbidden','forbidden','문자 처리 권한이 없습니다. 관리자 계정을 확인해주세요.']];
 const issue=known.find(([key])=>raw.includes(key));return issue?{code:issue[1],message:issue[2]}:{code:'unavailable',message:'문자 준비를 완료하지 못했습니다. 발송 기록을 확인한 뒤 다시 준비해주세요.'};
}
export class SmsPreparationError extends Error{constructor(public readonly code:SmsPreparationCode,message:string){super(message);}}
