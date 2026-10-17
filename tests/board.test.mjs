import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterPosts, boardInput } from '../src/lib/board-model.ts';
const post = (id, category, is_pinned, created_at) => ({id, category, is_pinned, created_at, title:'회의', body:'운영 일정', author_name:'주호'});
test('only pinned notices lead; unpinned notices use creation order', () => {
 const rows=[post('a','공지',false,'2026-01-01'),post('b','자유',false,'2026-03-01'),post('c','공지',true,'2025-01-01'),post('d','시스템',true,'2026-02-01')];
 assert.deepEqual(filterPosts(rows,'').map(p=>p.id),['c','b','d','a']);
 assert.deepEqual(filterPosts(rows,' 주호 ','공지',true).map(p=>p.id),['c']);
 assert.equal(filterPosts(rows,'없는 검색어').length,0);
 assert.equal(filterPosts(rows,'운영').length,4);
});
test('category changes clear pins and invalid input is rejected', () => {
 const f=new FormData(); f.set('title',' 제목 ');f.set('body',' 본문 ');f.set('category','공지');f.set('is_pinned','on');
 assert.equal(boardInput(f).is_pinned,true);
 f.set('category','자유');assert.equal(boardInput(f).is_pinned,false);
 f.set('category','위조');assert.throws(()=>boardInput(f));
 f.set('category','공지');f.set('title',' ');assert.throws(()=>boardInput(f));
});
