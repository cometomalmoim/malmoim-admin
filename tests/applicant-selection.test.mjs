import {test} from 'node:test';
import assert from 'node:assert/strict';
import {archiveSelection,applicantKey} from '../src/lib/applicant-selection.ts';
const row={id:'00000000-0000-0000-0000-000000000001',event_id:'00000000-0000-0000-0000-000000000002',source:'manual',revision:0,archive_revision:0};
test('일괄 삭제는 접수 출처와 두 버전을 보존하며 추가 속성은 전송하지 않음',()=>{
 assert.deepEqual(archiveSelection([{...row,name:'가상'}]),[row]);
 assert.notEqual(applicantKey(row),applicantKey({...row,source:'registration'}));
});
test('빈 선택·중복·상한 초과·잘못된 식별자·버전 거부',()=>{
 for(const input of [[],[row,row],Array(26).fill(row),[{...row,id:'bad'}],[{...row,revision:-1}],[{...row,archive_revision:NaN}],[{...row,source:'other'}]])assert.throws(()=>archiveSelection(input));
});
