// Static source assertions + JS predicate models ONLY. No PostgreSQL parser,
// connection, SQL execution, Storage request or concurrency verification.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
const sql=readFileSync(new URL('../../drafts/history-activity-integrated.NOT-FOR-EXECUTION.sql',import.meta.url),'utf8');
function body(name){const start=sql.indexOf(`CREATE FUNCTION history_upload_private.${name}(`);assert.ok(start>=0);return sql.slice(start,sql.indexOf('END $$;',start)+7);}
const entries=[['cas','p_revision','j.revision',0],['reserve_batch','p_revision','j.revision',0],['append_observation','p_tracking_revision','f.tracking_revision',0],['request_delete','p_revision','a.revision',1]];
for(const [name,arg,current,min] of entries){
 const source=body(name);
 test(`${name}: guard and NULL-safe comparison precede mutation, comparison follows locks`,()=>{
  const guard=`IF ${arg} IS NULL OR ${arg} < ${min} OR ${arg} > 9007199254740991`;
  const comparison=`IF ${current} IS DISTINCT FROM ${arg} THEN RETURN false; END IF;`;
  assert.ok(source.includes(guard));assert.match(source,/Invalid expected revision' USING ERRCODE='22023'/);
  assert.ok(source.indexOf(guard)<source.indexOf('FOR UPDATE'));
  assert.ok(source.indexOf(comparison)>source.indexOf('FOR UPDATE'));
  const mutation=source.search(/\n (?:UPDATE|INSERT INTO) /);assert.ok(mutation>source.indexOf(comparison));
  assert.ok(source.includes('require_server(p_actor,'));
 });
 // Model only the extracted numeric range and documented NULL-safe equality.
 const lower=Number(source.match(new RegExp(`${arg} < (\\d+)`))[1]);
 const upper=Number(source.match(new RegExp(`${arg} > (\\d+)`))[1]);
 function model(expected,actual){if(expected===null||expected<lower||expected>upper)return 'invalid';return expected!==actual?'conflict':'match';}
 for(const [label,expected,actual,result] of [['NULL',null,3,'invalid'],['negative',-1,3,'invalid'],['out of range',9007199254740992,3,'invalid'],['stale',2,3,'conflict'],['current',3,3,'match']])
  test(`${name}: static predicate model ${label}`,()=>assert.equal(model(expected,actual),result));
 test(`${name}: lower boundary model`,()=>assert.equal(model(min,min),'match'));
}
const observation=body('append_observation');
test('observation clock is freshly assigned after last row lock and before freshness check',()=>{
 assert.match(observation,/aid uuid; t timestamptz;/);
 assert.doesNotMatch(observation,/t timestamptz\s*:=/);
 const clock=observation.indexOf('t:=clock_timestamp();');
 assert.ok(clock>observation.lastIndexOf('FOR UPDATE'));
 assert.ok(clock>observation.indexOf('IF NOT FOUND THEN'));
 assert.ok(clock<observation.indexOf('p_checked>t'));
 assert.ok(observation.indexOf('p_checked>t')<observation.indexOf('INSERT INTO'));
 assert.match(observation,/p_first IS NULL OR p_second IS NULL OR p_checked IS NULL/);
 for(const value of ['p_first','p_second','p_checked'])assert.ok(observation.includes(`NOT pg_catalog.isfinite(${value})`));
 assert.match(observation,/p_first>p_second OR p_second>p_checked OR p_checked>t/);
});
const ttl=Number(observation.match(/t-p_first>interval '(\d+) seconds'/)[1])*1000;
// Millisecond JS model is not PostgreSQL timestamptz execution.
function fresh(first,second,checked,afterLocks){return [first,second,checked].every(v=>v!==null&&Number.isFinite(v)) && first<=second&&second<=checked&&checked<=afterLocks&&afterLocks-first<=ttl;}
for(const [label,values,expected] of [
 ['normal',[900,950,1000,1100],true],['boundary',[0,1,2,5000],true],
 ['long lock wait',[900,950,1000,10000],false],['just expired',[0,1,2,5001],false],
 ['future checked',[900,950,1200,1100],false],['future samples',[1200,1201,1202,1100],false],
 ['missing first',[null,950,1000,1100],false],['missing second',[900,null,1000,1100],false],
 ['missing checked',[900,950,null,1100],false],['infinite',[900,950,Infinity,1100],false],
 ['reversed samples',[950,900,1000,1100],false],
])test(`observation static clock model: ${label}`,()=>assert.equal(fresh(...values),expected));
test('execution, server authentication/reporting and write gates remain closed',()=>{
 assert.match(sql,/BEGIN;\s*DO \$blocked\$ BEGIN RAISE EXCEPTION 'NOT-FOR-EXECUTION/);
 assert.ok(sql.trimEnd().endsWith('ROLLBACK;'));assert.doesNotMatch(sql,/^COMMIT;/m);
 assert.match(body('require_server'),/RAISE EXCEPTION 'Server authentication\/report capability unresolved; disabled'/);
 assert.match(body('report'),/RAISE EXCEPTION 'NOT IMPLEMENTED/);
 assert.match(sql,/IF p_mode IN \('insert','delete'\) THEN RETURN false/);
 assert.match(sql,/file_size_limit=4718592/);assert.match(sql,/total>47185920/);
 assert.match(observation,/NEVER set completed, ready, end_confirmed/);
});
test('remaining legacy public revision comparison has an explicit prior NULL guard',()=>{
 const start=sql.indexOf('CREATE FUNCTION public.history_manage_activity(');const legacy=sql.slice(start,sql.indexOf('END $$;',start));
 assert.ok(legacy.indexOf('p_activity IS NULL OR p_revision IS NULL')<legacy.indexOf('a.revision<>p_revision'));
 // This legacy path has no NULL bypass; finite JS-safe range alignment is deferred.
});
