import type {MessageEvent,MessageApplicant,MessageRefund} from './message-preview';
export const demoEvents:MessageEvent[]=[{id:'demo-paid',title:'[가상] 행사 A',fee:30000,due:'2026-10-25 18:00 (KST, 가상 일정)',notice:'[가상 입금 안내] 테스트 계좌 — 실제 입금하지 마세요.'},{id:'demo-free',title:'[가상] 무료 행사',fee:0,due:'',notice:''},{id:'demo-undecided',title:'[가상] 참가비 미정 행사',fee:null,due:'',notice:''}];
const base={eventId:'demo-paid',source:'registration',contactType:'phone',status:'accepted',payment:'unpaid',paidAmount:null};
export const demoApplicants:MessageApplicant[]=[
 {...base,id:'1',name:'가상 신청자 A',contact:'01000000001'},
 {...base,id:'2',name:'가상 신청자 B',contact:'01000000002'},
 {...base,id:'3',name:'미확인 예시',contact:'01000000003',payment:'unknown'},
 {...base,id:'4',name:'확인 대기 예시',contact:'01000000004',payment:'pending_confirmation'},
 {...base,id:'5',name:'납부 완료 예시',contact:'01000000005',payment:'paid'},
 {...base,id:'6',name:'환불 상태 예시',contact:'01000000006',payment:'refunded'},
 {...base,id:'7',name:'대기 선발 예시',contact:'01000000007',status:'waitlisted'},
 {...base,id:'8',name:'환불 요청 예시',contact:'01000000008'},
 {...base,id:'9',name:'번호 오류 예시',contact:'not-a-phone'},
 {...base,id:'10',name:'인스타 연락처 예시',contact:'demo_account',contactType:'instagram'},
 {...base,id:'11',name:'중복 번호 예시',contact:'+82 10 0000 0001'},
 {...base,id:'12',name:'납부액 기록 예시',contact:'01000000012',paidAmount:30000},
 {...base,id:'1',eventId:'demo-free',name:'무료 행사 신청 예시',contact:'01000000001'},
 {...base,id:'1',eventId:'demo-undecided',name:'금액 미정 신청 예시',contact:'01000000001'}];
export const demoRefunds:MessageRefund[]=[{eventId:'demo-paid',source:'registration',applicationId:'8',status:'requested'}];
