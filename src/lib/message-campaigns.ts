export const messageCampaigns={
 accepted:{label:'합격 안내',status:'accepted',payment:''},
 payment:{label:'참가비 미확인 안내',status:'accepted',payment:'unpaid'},
 confirmation:{label:'최종 참가 확정',status:'accepted',payment:'paid'},
 event:{label:'행사 안내',status:'accepted',payment:'paid'},
 reminder:{label:'참여 리마인드',status:'accepted',payment:'paid'},
 custom:{label:'직접 선택·작성',status:'',payment:''},
} as const;
export type MessageCampaign=keyof typeof messageCampaigns;
export function messageNoticeKind(template:{category:string;title:string}){
 const title=template.title;
 if(/환불.*완료|refund.*(complete|processed)/i.test(title))return 'refund_completed';
 if(/환불|refund/i.test(title))return 'refund';
 if(/입금.*(확인|완료)|payment.*(received|confirmed)/i.test(title)&&template.category!=='payment')return 'payment_received';
 if(template.category==='payment')return 'payment';
 if(template.category==='confirmation')return 'confirmation';
 if(/불합격|declined/i.test(title))return 'declined';
 if(/합격|accepted|selected/i.test(title))return 'accepted';
 if(/대기|waitlist/i.test(title))return 'waitlisted';
 if(template.category==='receipt')return 'receipt';
 if(template.category==='reminder'||/리마인드|reminder/i.test(title))return 'reminder';
 if(/이벤트 안내|행사 안내|event.*(notice|detail)/i.test(title))return 'event';
 return 'custom';
}
export function outsideMessageFilters(row:{name:string;contact:string;status:string;payment_status:string;preferred_class:string|null;nationality:string|null},filters:{query:string;status:string;payment:string;group:string;nationality:string}){
 const q=filters.query.trim().toLowerCase();
 if(q&&!`${row.name} ${row.contact}`.toLowerCase().includes(q))return true;
 if(filters.status&&row.status!==filters.status||filters.payment&&row.payment_status!==filters.payment||filters.group&&row.preferred_class!==filters.group)return true;
 if(filters.nationality){const value=(row.nationality??'').trim().toLowerCase();const korean=['대한민국','한국','한국인','south korea','korea','republic of korea','kr','kor','korean'].includes(value);const group=!value?'unknown':korean?'korean':'foreign';if(group!==filters.nationality)return true;}
 return false;
}

export function matchesNoticeFilter(notice:{state:string}|null|undefined,filter:string,complete=true){
 if(filter==='all')return true;
 if(filter==='unsent')return !notice&&complete;
 if(filter==='sent')return !!notice&&['accepted','delivered'].includes(notice.state);
 return !!notice&&notice.state==='failed';
}

export function summarizeNoticeHistory<T extends {kind:string;state:string}>(notices:T[]){
 // A newer cancelled draft must not hide a previously successful notice.
 const sorted=[...notices].sort((a,b)=>Number(['accepted','delivered'].includes(b.state))-Number(['accepted','delivered'].includes(a.state)));
 return sorted.filter((notice,index,all)=>all.findIndex(item=>item.kind===notice.kind)===index);
}
