import {test} from 'node:test';
import assert from 'node:assert/strict';
import {messageCampaigns,messageNoticeKind,outsideMessageFilters,matchesNoticeFilter,summarizeNoticeHistory} from '../src/lib/message-campaigns.ts';
test('recommendations distinguish unpaid from unverified and require confirmed paid applicants for event notices',()=>{
 assert.equal(messageCampaigns.payment.payment,'unpaid');assert.equal(messageCampaigns.payment.status,'accepted');assert.equal(messageCampaigns.event.payment,'paid');assert.equal(messageCampaigns.confirmation.status,'accepted');
});
test('notice filters do not confuse unknown or pending history with unsent and delivered states',()=>{
 assert.equal(matchesNoticeFilter(null,'unsent'),true);assert.equal(matchesNoticeFilter(null,'unsent',false),false);
 for(const state of ['draft','queued','dispatching','unknown','failed','cancelled']){assert.equal(matchesNoticeFilter({state},'unsent'),false);assert.equal(matchesNoticeFilter({state},'sent'),false);}
 assert.equal(matchesNoticeFilter({state:'accepted'},'sent'),true);assert.equal(matchesNoticeFilter({state:'delivered'},'sent'),true);assert.equal(matchesNoticeFilter({state:'failed'},'failed'),true);
});
test('saved Korean and English notice titles are classified by actual notice kind',()=>{
 assert.equal(messageNoticeKind({category:'custom',title:'목요일반 · 합격 안내'}),'accepted');assert.equal(messageNoticeKind({category:'custom',title:'불합격 안내'}),'declined');assert.equal(messageNoticeKind({category:'custom',title:'Payment received'}),'payment_received');assert.equal(messageNoticeKind({category:'payment',title:'참가비 확인 안내'}),'payment');assert.equal(messageNoticeKind({category:'confirmation',title:'참가 확정'}),'confirmation');
});
test('off-filter selection is identified without depending on the currently loaded page',()=>{
 const row={name:'Test',contact:'01012345678',status:'accepted',payment_status:'paid',preferred_class:'saturday',nationality:'대한민국'};
 const f={query:'',status:'accepted',payment:'paid',group:'',nationality:'korean'};assert.equal(outsideMessageFilters(row,f),false);assert.equal(outsideMessageFilters(row,{...f,group:'thursday'}),true);assert.equal(outsideMessageFilters(row,{...f,query:'another'}),true);assert.equal(outsideMessageFilters(row,{...f,payment:'unpaid'}),true);
});

test('a cancelled newer draft does not erase an older delivered notice',()=>{
 const history=summarizeNoticeHistory([{kind:'event',state:'cancelled'},{kind:'event',state:'delivered'},{kind:'accepted',state:'failed'}]);assert.equal(history.find(n=>n.kind==='event').state,'delivered');assert.equal(history.find(n=>n.kind==='accepted').state,'failed');
});
