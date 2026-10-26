import type {ApplicationRow} from './recruitment';
import type {PaymentNotice} from './payment-notice';
export type PendingPaymentNotice={row:ApplicationRow;kind:PaymentNotice;token:string};
// Browser memory only: survive a route refresh without storing applicant data on disk.
let queued:PendingPaymentNotice[]=[];
let gathering=false;
let pending:PendingPaymentNotice|null=null;
const emptyQueue:PendingPaymentNotice[]=[];
function sameApplicant(a:PendingPaymentNotice,b:PendingPaymentNotice){return a.row.event_id===b.row.event_id&&a.row.source===b.row.source&&a.row.id===b.row.id;}
function queueNotice(notice:PendingPaymentNotice){queued=[...queued.filter(item=>!sameApplicant(item,notice)),notice];}
const listeners=new Set<()=>void>();
export const paymentNoticeStore={
 subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
 snapshot(){return pending;},
 serverSnapshot(){return null;},
 offer(notice:PendingPaymentNotice){
  if(gathering&&(queued.length<50||queued.some(item=>sameApplicant(item,notice)))){queueNotice(notice);pending=null;}else pending=notice;
  listeners.forEach(listener=>listener());
 },
 queueSnapshot(){return queued;},
 queueServerSnapshot(){return emptyQueue;},
 gatheringSnapshot(){return gathering;},
 gatheringServerSnapshot(){return false;},
 gather(notice:PendingPaymentNotice){if(queued.length>=50&&!queued.some(item=>sameApplicant(item,notice)))return;queueNotice(notice);gathering=true;pending=null;listeners.forEach(listener=>listener());},
 stopGathering(){gathering=false;listeners.forEach(listener=>listener());},
 remove(token:string){queued=queued.filter(item=>item.token!==token);listeners.forEach(listener=>listener());},
 clearQueue(){queued=[];gathering=false;listeners.forEach(listener=>listener());},
 dismiss(){pending=null;listeners.forEach(listener=>listener());},
};
