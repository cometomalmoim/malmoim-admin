import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generationBudget,certificateLimits,jobId,templateMime} from '../src/lib/certificate-delivery.ts';
test('server generation limits bound count, bytes and wall time independently',()=>{
 assert.doesNotThrow(()=>generationBudget(20,64*1024*1024,45000));
 for(const args of [[0,0,0],[21,0,0],[1,certificateLimits.bytes+1,0],[1,0,45001]])assert.throws(()=>generationBudget(...args));
});
test('job IDs are constrained and template bytes rather than extensions determine MIME',()=>{
 assert.equal(jobId('11111111-1111-4111-8111-111111111111'),'11111111-1111-4111-8111-111111111111');
 for(const value of [undefined,'../other','token',''])assert.throws(()=>jobId(value));
 assert.equal(templateMime(Buffer.from('%PDF-1.7')),'application/pdf');
 assert.equal(templateMime(new Uint8Array([137,80,78,71,13,10,26,10])),'image/png');
 assert.equal(templateMime(new Uint8Array([255,216,255])),'image/jpeg');
 for(const bytes of [new Uint8Array(),Buffer.from('fake.pdf'),new Uint8Array(5242881)])assert.throws(()=>templateMime(bytes));
});
