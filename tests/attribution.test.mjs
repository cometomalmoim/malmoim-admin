import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readAttribution,taggedRecruitmentUrl,trafficSources} from '../src/lib/attribution.ts';
test('5개 채널 링크를 정확한 source로 생성하고 기존 쿼리·앵커를 보존',()=>{
 for(const source of Object.keys(trafficSources)){const url=new URL(taggedRecruitmentUrl('https://malmoim.com/2026halloweenparty?lang=ko&source=old#apply',source,'paid_social','할로윈'));assert.equal(url.searchParams.get('utm_source'),source);assert.equal(url.searchParams.get('lang'),'ko');assert.equal(url.searchParams.get('utm_campaign'),'할로윈');assert.equal(url.searchParams.has('source'),false);assert.equal(url.hash,'#apply');}
});
test('표준 UTM 우선, source 별칭과 한글 채널 정규화',()=>{
 assert.equal(readAttribution(new URLSearchParams('source=당근')).utm_source,'daangn');
 assert.equal(readAttribution(new URLSearchParams('utm_source=naver&source=meta')).utm_source,'naver');
 assert.equal(readAttribution(new URLSearchParams('utm_source=Instagram')).utm_source,'instagram');
});
test('태그 없는 신청은 미확인, 길이 제한 및 제어문자 제거',()=>{
 assert.deepEqual(readAttribution(new URLSearchParams()),{utm_source:'',utm_medium:'',utm_campaign:''});
 assert.equal(readAttribution(new URLSearchParams({utm_campaign:'x'.repeat(200)})).utm_campaign.length,150);
 assert.equal(readAttribution(new URLSearchParams({utm_source:'na\nver'})).utm_source,'naver');
 assert.throws(()=>taggedRecruitmentUrl('javascript:alert(1)','naver','',''));
});
