import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountFaviconUrl} from '../src/lib/external-account-favicon.ts';

test('favicon uses only the normalized hostname, never private path or query data',()=>{
  assert.equal(accountFaviconUrl('https://www.Canva.com/team/private?token=secret#section'),'https://www.google.com/s2/favicons?domain=www.canva.com&sz=64');
  assert.equal(accountFaviconUrl('https://figma.com'),'https://www.google.com/s2/favicons?domain=figma.com&sz=64');
});
test('missing, unsafe, credential-bearing and local URLs use a fallback without a request',()=>{
  for(const url of [null,undefined,'','bad-url','javascript:alert(1)','http://figma.com','https://user:secret@figma.com','https://localhost','https://127.0.0.1','https://[::1]','https://service.internal','https://team.local'])assert.equal(accountFaviconUrl(url),null,url);
});
