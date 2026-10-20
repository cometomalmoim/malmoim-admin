export const messagingTemplates = [
  {id:'inquiry_reply',label:'문의 답변 완료',icon:'↪',description:'문의자 한 명에게 전용 답변 링크 안내',body:'{이름}님, {이벤트명} 문의에 운영진 답변이 등록되었습니다.\n아래 전용 링크에서 확인해주세요.\n{답변링크}\n이 링크는 문의자 본인만 확인해주세요.'},
  {id:'payment',label:'입금 안내',icon:'₩',description:'참가비와 입금 방법 안내',body:'{이름}님, {이벤트명} 참가비 안내드립니다.\n{참가비안내}\n납부 기한: {납부기한}\n입금 후 운영진에게 확인을 요청해주세요.'},
  {id:'refund',label:'환불 안내',icon:'↩',description:'환불 요청 접수 안내',body:'{이름}님, {이벤트명} 환불 요청이 접수되었습니다.\n운영진이 요청 내용을 확인한 뒤 처리 결과를 안내드리겠습니다.\n문의: {문의처}'},
  {id:'accepted',label:'합격 안내',icon:'✓',description:'선발 결과와 행사 정보 안내',body:'{이름}님, {이벤트명} 참가자로 선정되셨습니다.\n일시: {일정}\n장소: {장소}\n참여 관련 문의: {문의처}'},
  {id:'declined',label:'불합격 안내',icon:'✉',description:'미선발 결과 안내',body:'{이름}님, {이벤트명}에 관심을 갖고 신청해주셔서 감사합니다.\n아쉽게도 이번 행사에는 함께하지 못하게 되었습니다.\n다음 기회에 다시 만나 뵙기를 바랍니다.'},
  {id:'event',label:'이벤트 안내',icon:'◇',description:'일정과 장소 안내',body:'{이름}님, {이벤트명} 안내드립니다.\n일시: {일정}\n장소: {장소}\n문의: {문의처}'},
  {id:'reminder',label:'참여 리마인드',icon:'◷',description:'행사 전 참여 일정 재안내',body:'{이름}님, {이벤트명} 참여 일정을 다시 안내드립니다.\n일시: {일정}\n장소: {장소}\n참여가 어려우시면 {문의처}로 연락해주세요.'},
  {id:'waitlisted',label:'대기 안내',icon:'…',description:'참가 대기 상태 안내',body:'{이름}님, {이벤트명} 참가 대기자로 등록되셨습니다.\n추가 참여가 가능해지면 운영진이 별도로 안내드리겠습니다.\n문의: {문의처}'},
] as const;

export function composeMessaging(template:string,values:Record<string,string>){
 const missing=new Set<string>();
 const text=template.replace(/\{([^{}]+)\}/g,(token,key:string)=>{
  if(!Object.hasOwn(values,key)||!values[key].trim()){missing.add(key);return token;}
  return values[key];
 });
 return {text,missing:[...missing],empty:!template.trim()};
}
