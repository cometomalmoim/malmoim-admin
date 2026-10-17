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

test('date filters include both Korean calendar boundaries and combine with authors', async () => {
 const { boardDay, quickPeriod } = await import('../src/lib/board-model.ts');
 const rows=[
 {...post('a','공지',true,'2026-10-16T14:59:59Z'),author_id:'me'},
 {...post('b','공지',true,'2026-10-16T15:00:00Z'),author_id:'me'},
 {...post('c','자유',false,'2026-10-17T14:59:59Z'),author_id:'other'},
 {...post('d','공지',false,'2026-10-17T15:00:00Z'),author_id:'me'}];
 assert.equal(boardDay(rows[1].created_at),'2026-10-17');
 assert.deepEqual(filterPosts(rows,'','',false,{start:'2026-10-17',end:'2026-10-17'}).map(p=>p.id),['b','c']);
 assert.deepEqual(filterPosts(rows,'주호','공지',true,{start:'2026-10-17',end:'2026-10-17',authorId:'me'}).map(p=>p.id),['b']);
 assert.equal(filterPosts(rows,'','',false,{start:'2026-10-18',end:'2026-10-17'}).length,0);
 assert.deepEqual(quickPeriod('week',new Date('2026-10-16T16:00:00Z')),{start:'2026-10-11',end:'2026-10-17'});
 assert.deepEqual(quickPeriod('month',new Date('2026-03-31T00:00:00Z')),{start:'2026-02-28',end:'2026-03-31'});
 assert.deepEqual(quickPeriod('all'),{start:'',end:''});
});
