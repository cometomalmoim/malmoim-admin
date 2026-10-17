import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boardPage, boardPageNumbers } from '../src/lib/board-pagination.ts';
test('ten posts per page, exact boundary and partial final page', () => {
 const rows=Array.from({length:25},(_,i)=>i);
 assert.deepEqual(boardPage(rows,1).rows,rows.slice(0,10));
 assert.deepEqual(boardPage(rows,2).rows,rows.slice(10,20));
 assert.deepEqual(boardPage(rows,3).rows,[20,21,22,23,24]);
 assert.equal(boardPage(rows.slice(0,10),1).totalPages,1);
 assert.equal(boardPage(rows.slice(0,11),1).totalPages,2);
});
test('empty results and shrinking lists clamp the selected page', () => {
 assert.deepEqual(boardPage([],9),{page:1,totalPages:1,rows:[]});
 assert.equal(boardPage([1,2],4).page,1);
 assert.equal(boardPage([1,2],0).page,1);
});
test('number controls retain first, last and nearby pages with bounded gaps', () => {
 assert.deepEqual(boardPageNumbers(1,3),[1,2,3]);
 assert.deepEqual(boardPageNumbers(5,10),[1,'…',4,5,6,'…',10]);
 assert.deepEqual(boardPageNumbers(1,1),[1]);
});
