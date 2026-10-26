export const messagingTemplates = [
  {id:'receipt',label:'신청 접수',icon:'✓',description:'신청 접수 사실만 안내',body:"안녕하세요, 말모임 운영진입니다.\n\n{이름}님, {이벤트명}에 신청해주셔서 감사합니다. 신청이 잘 접수되었어요.\n참여 결과와 다음 일정은 준비되는 대로 안내드리겠습니다."},
  {id:'payment_received',label:'입금 확인 안내',icon:'₩',description:'입금 확인, 최종 참가 확정과 구분',body:"안녕하세요, 말모임 운영진입니다.\n\n{이름}님, {이벤트명} 참가비 입금이 확인되었어요. 함께해주셔서 감사합니다.\n참가 확정과 자세한 행사 소식은 별도로 안내드릴게요."},
  {id:'confirmation',label:'최종 참가 확정',icon:'✓',description:'합격 및 납부 완료 대상의 최종 확정',body:"안녕하세요, 말모임 운영진입니다.\n\n{이름}님, {이벤트명}에서 함께하게 되어 반갑습니다. 참가가 최종 확정되었어요.\n일시: {일정}\n장소: {장소}\n즐거운 만남을 준비하고 기다릴게요!"},
  {id:'refund_completed',label:'환불 완료 안내',icon:'↩',description:'운영진 실제 환불 완료 확인 후 안내',body:"안녕하세요, 말모임 운영진입니다.\n\n{이름}님, {이벤트명} 참가비 환불이 완료되어 안내드립니다.\n이번에는 함께하지 못해 아쉽지만, 다음에 좋은 기회로 다시 만나요. 감사합니다."},
  {id:'inquiry_reply',label:'문의 답변 완료',icon:'↪',description:'문의자 한 명에게 전용 답변 링크 안내',body:"안녕하세요, 말모임 운영진입니다.\n\n{이름}님, {이벤트명}에 남겨주신 문의에 답변을 준비했어요.\n아래 전용 링크에서 편하게 확인하실 수 있습니다.\n{답변링크}\n개인 문의 내용이 담겨 있으니 링크는 본인만 이용해주세요."},
  {id:'payment',label:'입금 안내',icon:'₩',description:'참가비와 입금 방법 안내',body:"안녕하세요, 말모임 운영진입니다.\n\n{이름}님, {이벤트명}에 함께해주셔서 감사합니다.\n현재 참가비 납부 내역이 아직 확인되지 않아 참여 안내를 드립니다.\n참가비 안내: {참가비안내}\n이미 납부하셨다면 확인에 시간이 걸릴 수 있는 점 양해 부탁드립니다.\n함께할 시간을 즐겁게 준비하고 있을게요. 감사합니다."},
  {id:'refund',label:'환불 요청 접수',icon:'↩',description:'환불 요청 접수 안내',body:"안녕하세요, 말모임 운영진입니다.\n\n{이름}님, {이벤트명} 환불 요청이 접수되었어요.\n처리가 마무리되면 다시 안내드리겠습니다. 기다려주셔서 감사합니다."},
  {id:'accepted',label:'합격 안내',icon:'✓',description:'선발 결과와 행사 정보 안내',body:"안녕하세요, 말모임 운영진입니다.\n\n{이름}님, 반가운 소식 전해드려요. {이벤트명} 참가자로 선정되셨습니다!\n일시: {일정}\n장소: {장소}\n이후 참여 절차는 별도로 안내드릴게요. 함께할 시간을 기대하겠습니다."},
  {id:'declined',label:'불합격 안내',icon:'✉',description:'미선발 결과 안내',body:"안녕하세요, 말모임 운영진입니다.\n\n{이름}님, {이벤트명}에 관심을 갖고 신청해주셔서 감사합니다.\n아쉽게도 이번에는 함께하지 못하게 되었습니다. 보내주신 관심에 진심으로 감사드리며, 다음에 좋은 기회로 다시 만나 뵙기를 바랍니다."},
  {id:'event',label:'이벤트 안내',icon:'◇',description:'일정과 장소 안내',body:"안녕하세요, 말모임 운영진입니다.\n\n{이름}님, {이벤트명}에서 함께할 시간을 안내드려요.\n일시: {일정}\n장소: {장소}\n편안한 마음으로 오셔서 즐거운 시간 함께해요!"},
  {id:'reminder',label:'참여 리마인드',icon:'◷',description:'행사 전 참여 일정 재안내',body:"안녕하세요, 말모임 운영진입니다.\n\n{이름}님, {이벤트명}에서 만날 시간이 다가오고 있어요.\n일시: {일정}\n장소: {장소}\n오시는 길 조심하시고, 곧 반갑게 만나요!"},
  {id:'waitlisted',label:'대기 안내',icon:'…',description:'참가 대기 상태 안내',body:"안녕하세요, 말모임 운영진입니다.\n\n{이름}님, {이벤트명}에 관심을 갖고 신청해주셔서 감사합니다.\n현재는 참가 대기 상태로 접수되어 있어요. 자리가 마련되면 순서에 따라 소식 전해드리겠습니다. 기다려주셔서 감사합니다."},
] as const;

export function composeMessaging(template:string,values:Record<string,string>){
 const missing=new Set<string>();
 const text=template.replace(/\{([^{}]+)\}/g,(token,key:string)=>{
  if(!Object.hasOwn(values,key)||!values[key].trim()){missing.add(key);return token;}
  return values[key];
 });
 return {text,missing:[...missing],empty:!template.trim()};
}
