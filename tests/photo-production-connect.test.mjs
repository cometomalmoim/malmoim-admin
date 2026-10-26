import {test} from 'node:test';
import assert from 'node:assert/strict';
import {simplePhotosEnabled,SIMPLE_BUCKET,SIMPLE_MAX_BYTES} from '../src/lib/history-simple/policy.ts';
const approved={NODE_ENV:'production',VERCEL_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://qkhlvdctdcpfyvohhikl.supabase.co',HISTORY_PHOTO_PRODUCTION_ENABLED:'true',HISTORY_PHOTO_PRODUCTION_REVIEWED:'true'};
test('production photos require every explicit release condition',()=>{
 assert.equal(simplePhotosEnabled(approved),true);
 assert.equal(simplePhotosEnabled({}),false);
 for(const key of Object.keys(approved))assert.equal(simplePhotosEnabled({...approved,[key]:undefined}),false,key);
 for(const mode of ['preview','development','test'])assert.equal(simplePhotosEnabled({...approved,VERCEL_ENV:mode}),false);
 for(const mode of ['development','test'])assert.equal(simplePhotosEnabled({...approved,NODE_ENV:mode}),false);
 for(const flag of ['false','TRUE','1','']){
  assert.equal(simplePhotosEnabled({...approved,HISTORY_PHOTO_PRODUCTION_ENABLED:flag}),false);
  assert.equal(simplePhotosEnabled({...approved,HISTORY_PHOTO_PRODUCTION_REVIEWED:flag}),false);
 }
});
test('wrong targets and local-mode configuration remain disabled',()=>{
 for(const url of ['https://other-project.supabase.co','http://127.0.0.1:61521',approved.NEXT_PUBLIC_SUPABASE_URL+'/'])assert.equal(simplePhotosEnabled({...approved,NEXT_PUBLIC_SUPABASE_URL:url}),false);
 assert.equal(simplePhotosEnabled({...approved,SUPABASE_LOCAL_TEST:'true'}),false);
 assert.equal(simplePhotosEnabled({HISTORY_PHOTO_SIMPLE_TEST_ENABLED:'true'}),false);
});
test('installed bucket and normalized upload limit keep their exact contract',()=>{
 assert.equal(SIMPLE_BUCKET,'history-simple-photos');assert.equal(SIMPLE_MAX_BYTES,4194304);
});
