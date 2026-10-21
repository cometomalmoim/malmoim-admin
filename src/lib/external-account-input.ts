import {accountCategories} from './external-account-types.ts';
import {validUuid} from './resource-validation.ts';
export function externalAccountInput(form:FormData) {
  const value=(name:string,fallback='')=>String(form.get(name)??'').trim()||fallback;
  const input={service_name:value('service_name'),service_url:value('service_url'),login_id:value('login_id'),category:value('category','other'),department:value('department'),primary_manager:value('primary_manager'),sub_manager:value('sub_manager'),billing_cycle:value('billing_cycle','monthly'),payment_method:value('payment_method'),amount:value('amount','0'),currency:value('currency','KRW'),next_billing_date:value('next_billing_date'),renewal_notice_days:value('renewal_notice_days','7'),notes:value('notes')};
  if(!input.service_name||input.service_name.length>120||!input.login_id||input.login_id.length>254)throw new Error('서비스명(120자 이하)과 계정 ID(254자 이하)를 입력해주세요.');
  let url:URL;try{url=new URL(input.service_url);}catch{throw new Error('HTTPS 서비스 URL을 입력해주세요.');}
  if(url.protocol!=='https:'||url.username||url.password||input.service_url.length>2000)throw new Error('인증 정보가 없는 HTTPS 서비스 URL을 입력해주세요.');
  if(!Object.hasOwn(accountCategories,input.category)||!['monthly','yearly','none'].includes(input.billing_cycle)||!['KRW','USD','EUR','JPY'].includes(input.currency))throw new Error('카테고리·결제 주기·통화를 확인해주세요.');
  if(!/^\d+(\.\d{1,2})?$/.test(input.amount)||Number(input.amount)>999999999999.99)throw new Error('결제 금액은 0 이상, 소수점 두 자리 이하로 입력해주세요.');
  if(!/^\d+$/.test(input.renewal_notice_days)||Number(input.renewal_notice_days)>90)throw new Error('갱신 알림은 0~90일로 입력해주세요.');
  for(const id of [input.primary_manager,input.sub_manager])if(id&&!validUuid(id))throw new Error('담당자를 다시 선택해주세요.');
  if(input.department.length>100||input.payment_method.length>120||input.notes.length>5000)throw new Error('부서·결제 수단·메모의 입력 길이를 확인해주세요.');
  if(input.next_billing_date){const date=new Date(input.next_billing_date+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(input.next_billing_date)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==input.next_billing_date)throw new Error('올바른 다음 결제일을 입력해주세요.');}
  return input;
}
