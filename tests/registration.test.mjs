import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registrationInput} from '../src/lib/registration-validation.ts';
function form(values={}){const data=new FormData();for(const [k,v] of Object.entries({name:'가상 테스트',contact:'010-0000-0000',history:'new',history_detail:'',privacy_consent:'on',submission_id:'11111111-1111-4111-8111-111111111111',...values}))data.set(k,v);return data;}
test('전화번호 표기 통합으로 중복 우회 방지',()=>{assert.equal(registrationInput(form()).contact,'+821000000000');assert.equal(registrationInput(form({contact:'+82 10 0000 0000'})).contact,'+821000000000');assert.equal(registrationInput(form({contact:'0082-10-0000-0000'})).contact,'+821000000000');});
test('동의 누락·잘못된 전화번호·응답·식별자 차단',()=>{for(const bad of [{privacy_consent:''},{contact:'abc'},{name:' '},{history:'other'},{history:'returning',history_detail:'x'.repeat(301)},{submission_id:'invalid'}])assert.throws(()=>registrationInput(form(bad)));});
test('첫 참가 응답의 과거 활동 내용은 저장하지 않음',()=>{assert.equal(registrationInput(form({history_detail:'보내면 안 되는 값'})).detail,'');});
test('출생연도 선택 입력: 미입력·유효한 연도·경계',()=>{const year=new Date(Date.now()+9*3600000).getUTCFullYear();assert.equal(registrationInput(form()).birth_year,null);assert.equal(registrationInput(form({birth_year:'1998'})).birth_year,1998);assert.equal(registrationInput(form({birth_year:'1900'})).birth_year,1900);assert.equal(registrationInput(form({birth_year:String(year)})).birth_year,year);});
test('나이·미래·소수·짧은 출생연도는 거부',()=>{for(const value of ['28','98','1899',String(new Date().getUTCFullYear()+1),'1998.5','1e03','abcd','19980'])assert.throws(()=>registrationInput(form({birth_year:value})),/birth_year/);});

test('할로윈 공개 접수는 출생연도 필수 및 1990~2007 경계 적용',()=>{for(const birth_year of ['', '1989','2008'])assert.throws(()=>registrationInput(form({birth_year}),true),/birth_year/);for(const birth_year of ['1990','1998','2007'])assert.equal(registrationInput(form({birth_year}),true).birth_year,Number(birth_year));});

test('국적 선택 입력: 미입력은 null, 공백 제거, 복수 국적 허용, 100자 제한',()=>{
 assert.equal(registrationInput(form()).nationality,null);
 assert.equal(registrationInput(form({nationality:'   '})).nationality,null);
 assert.equal(registrationInput(form({nationality:' 대한민국 / Canada '})).nationality,'대한민국 / Canada');
 assert.equal(registrationInput(form({nationality:'x'.repeat(100)})).nationality.length,100);
 assert.throws(()=>registrationInput(form({nationality:'x'.repeat(101)})),/nationality/);
});
