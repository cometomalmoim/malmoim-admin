import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterTemplateOriginal,templateDraftDirty} from '../src/lib/sms-template-draft.ts';
test('preparation backing template uses the original starter rather than edited message content',()=>{const t={body:'ORIGINAL {이름}',language:'ko'};assert.equal(starterTemplateOriginal(t),'ORIGINAL {이름}');assert.equal(templateDraftDirty(t.body,'EDITED'),true);assert.equal(templateDraftDirty(t.body,t.body),false);});
test('one-off free messages get a neutral backing template without storing user edits as the original',()=>{assert.ok(starterTemplateOriginal({body:'',language:'ko'}).includes('{이름}'));assert.ok(starterTemplateOriginal({body:'',language:'en'}).startsWith('Hello'));});
