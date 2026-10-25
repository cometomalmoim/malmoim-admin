import {test} from 'node:test';
import assert from 'node:assert/strict';
import {changedPaymentNotice,paymentNoticeTemplate,paymentReceivedExamples} from '../src/lib/payment-notice.ts';
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
