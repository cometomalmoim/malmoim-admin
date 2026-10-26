import type {ApplicationRow} from './recruitment';
import type {PaymentNotice} from './payment-notice';
export type PendingPaymentNotice={row:ApplicationRow;kind:PaymentNotice;token:string};
// Browser memory only: survive a route refresh without storing applicant data on disk.
let pending:PendingPaymentNotice|null=null;
const listeners=new Set<()=>void>();
export const paymentNoticeStore={
 subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
 snapshot(){return pending;},
 serverSnapshot(){return null;},
 offer(notice:PendingPaymentNotice){pending=notice;listeners.forEach(listener=>listener());},
 dismiss(){pending=null;listeners.forEach(listener=>listener());},
};
