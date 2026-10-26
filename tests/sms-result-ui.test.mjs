import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import {smsStates} from '../src/lib/sms-contract.ts';
import {smsResultSummary} from '../src/lib/sms-result.ts';
const module={exports:{}};
const source=ts.transpileModule(readFileSync(new URL('../src/components/admin/sms-send-result.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
runInNewContext(source,{module,exports:module.exports,require:key=>({'react':React,'react/jsx-runtime':jsx,'@/lib/sms-contract':{smsStates},'@/lib/sms-result':{smsResultSummary},'./event-sms-logs':{EventSmsLogs:()=>null}})[key]});
test('result view shows the actual outcome without cost, send buttons or a pre-send heading',()=>{
 const html=renderToStaticMarkup(React.createElement(module.exports.SmsSendResult,{rows:[{id:'test',batch_id:'test',name:'TEST',to:'010****1234',body:'TEST MESSAGE',state:'accepted',reason:null}],event:'event',batches:['test'],busy:false,note:'',inDialog:true,onDone:()=>{}}));
 assert.ok(html.includes('발송 완료 · 도달 확인 중'));assert.ok(html.includes('TEST MESSAGE'));assert.ok(html.includes('문자 이력 보기'));
 for(const text of ['발송 전 최종 확인','예상 비용','실제 발송','목록으로 돌아가기'])assert.ok(!html.includes(text));
});
