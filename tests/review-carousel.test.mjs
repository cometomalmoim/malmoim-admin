import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewSlideIndex} from '../src/lib/review-carousel.ts';
test('6개 후기를 순서대로 순환하고 첫 후기의 이전은 마지막 후기다',()=>{
 assert.equal(reviewSlideIndex(5,1,6),0);
 assert.equal(reviewSlideIndex(0,-1,6),5);
 assert.deepEqual(Array.from({length:6},(_,i)=>reviewSlideIndex(i,1,6)),[1,2,3,4,5,0]);
});
test('후기 개수가 바뀌거나 없어도 유효한 인덱스다',()=>{
 assert.equal(reviewSlideIndex(5,1,2),0);
 assert.equal(reviewSlideIndex(0,1,0),0);
});
