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
runInNewContext(source,{module,exports:module.exports,require:key=>({'react':React,'react/jsx-runtime':jsx,'@/lib/sms-contract':{smsStates},'@/lib/sms-result':{smsResultSummary},'@/app/actions/event-sms':{},'./use-sms-delivery':{useSmsDelivery:()=>[]},'./event-sms-logs':{EventSmsLogs:()=>null}})[key]});
test('result view shows the actual outcome without cost, send buttons or a pre-send heading',()=>{
 const html=renderToStaticMarkup(React.createElement(module.exports.SmsSendResult,{rows:[{id:'test',batch_id:'test',name:'TEST',to:'010****1234',body:'TEST MESSAGE',state:'accepted',reason:null}],event:'event',batches:['test'],busy:false,note:'',inDialog:true,onDone:()=>{}}));
 assert.ok(html.includes('발송 완료 · 도달 확인 중'));assert.ok(html.includes('TEST MESSAGE'));assert.ok(html.includes('문자 이력 보기'));
 for(const text of ['발송 전 최종 확인','예상 비용','실제 발송','목록으로 돌아가기'])assert.ok(!html.includes(text));
});

test('direct message review keeps personalized content and send button without price or consent checkbox',()=>{
 const prepared={id:'test',count:1,total:45,unit:45,type:'LMS',sender:'010****1234',recipient:'1명',items:[{to:'010****1234',text:'PERSONALIZED PREVIEW'}]};
 const review={exports:{}};const code=ts.transpileModule(readFileSync(new URL('../src/components/admin/sms-controls.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(code,{module:review,exports:review.exports,require:key=>({'react':{...React,useState:initial=>initial===null?[prepared,()=>{}]:React.useState(initial)},'react/jsx-runtime':jsx,'@/app/actions/messaging':{},'./use-sms-delivery':{useSmsDelivery:()=>[]},'@/lib/sms-contract':{smsStates}})[key]});
 const html=renderToStaticMarkup(React.createElement(review.exports.SmsSend,{input:{mode:'direct'}}));
 assert.ok(html.includes('PERSONALIZED PREVIEW'));assert.ok(html.includes('1명에게 발송'));assert.ok(!html.includes('type="checkbox"'));assert.ok(!html.includes('예상'));assert.ok(!html.includes('계정 단가'));assert.ok(html.includes('<details open=""'));
});
