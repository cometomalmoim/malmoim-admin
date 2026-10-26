import {test} from 'node:test';
import assert from 'node:assert/strict';
import {changedPaymentNotice,paymentNoticeTemplate,paymentReceivedExamples,refundNoticeTemplate,refundCompletedExamples} from '../src/lib/payment-notice.ts';
test('only changed paid/refunded statuses open a notice',()=>{
 assert.equal(changedPaymentNotice('unknown','paid'),'paid');assert.equal(changedPaymentNotice('paid','refunded'),'refunded');
 for(const [a,b] of [['paid','paid'],['refunded','refunded'],['paid','unpaid'],['unknown','unknown']])assert.equal(changedPaymentNotice(a,b),null);
});
test('paid popup excludes payment requests and unapproved final confirmations',()=>{
 assert.equal(paymentNoticeTemplate({category:'payment',title:'입금 요청'},'accepted'),false);
 assert.equal(paymentNoticeTemplate({category:'confirmation',title:'확정'},'received'),false);
 assert.equal(paymentNoticeTemplate({category:'confirmation',title:'확정'},'accepted'),true);
 for(const template of paymentReceivedExamples)assert.equal(paymentNoticeTemplate(template,'received'),true);
 assert.equal(paymentNoticeTemplate({category:'custom',title:'기타'},'accepted'),false);
});


test('saved notice survives listener remount and dismissal prevents stale replay',async()=>{
 const {paymentNoticeStore:store}=await import('../src/lib/payment-notice-store.ts');
 store.dismiss();let updates=0;
 const stop=store.subscribe(()=>updates++);
 const notice={row:{id:'synthetic'},kind:'paid',token:'test'};
 store.offer(notice);assert.equal(updates,1);stop();
 assert.equal(store.snapshot(),notice);assert.equal(store.serverSnapshot(),null);
 const remounted=store.subscribe(()=>updates++);
 assert.equal(store.snapshot().kind,'paid');store.dismiss();assert.equal(updates,2);assert.equal(store.snapshot(),null);remounted();
});


test('gathering keeps latest purpose per applicant and groups no silent overflow',async()=>{
 const {paymentNoticeStore:store}=await import('../src/lib/payment-notice-store.ts');store.clearQueue();store.dismiss();
 const item=(id,kind='paid')=>({row:{id,source:'manual',event_id:'event'},kind,token:id+kind});
 store.gather(item('1'));assert.equal(store.gatheringSnapshot(),true);assert.equal(store.snapshot(),null);
 store.offer(item('1','refunded'));assert.equal(store.queueSnapshot().length,1);assert.equal(store.queueSnapshot()[0].kind,'refunded');
 for(let n=2;n<=50;n++)store.offer(item(String(n)));
 store.offer(item('51'));assert.equal(store.queueSnapshot().length,50);assert.equal(store.snapshot().row.id,'51');
 store.remove('1refunded');assert.equal(store.queueSnapshot().length,49);
 store.clearQueue();store.dismiss();assert.equal(store.gatheringSnapshot(),false);
});


test('refund completed starters exclude request notices and do not invent an amount',()=>{
 for(const template of refundCompletedExamples){assert.equal(refundNoticeTemplate(template),true);assert.ok(!/금액|참가비}/.test(template.body));}
 assert.equal(refundNoticeTemplate({category:'custom',title:'환불 요청 접수'}),false);
});
