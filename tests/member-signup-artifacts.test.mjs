import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {prepareMemberSignupArtifacts} from "../scripts/member-signup-policy.mjs";
import {enabledRelease} from "./fixtures/member-registration-release.mjs";

test("single installer immediately enables signup with versioned undated documents",()=>{
 const artifacts=prepareMemberSignupArtifacts();
 assert.equal(readFileSync("src/lib/member-legal-documents.ts","utf8"),artifacts.documentSource);
 const setup=readFileSync("supabase/manual/20261022_member_signup_setup.sql","utf8");
 assert.ok(setup.includes(artifacts.policySql));
 assert.doesNotMatch(setup,/terms_effective_date|privacy_effective_date|"effectiveDate"/);
 assert.match(artifacts.policySql,/values\('signup-v1','terms-v1','privacy-v1'/);
 assert.match(artifacts.policySql,/,true\);/);
 assert.doesNotMatch(setup+artifacts.documentSource,/signup-test-v1|terms-test-v1|privacy-test-v1|"stage"|mode='test'|mode='production'|2026-10-22/);
 assert.equal((setup.match(/^begin;$/gm)||[]).length,1);
 assert.equal((setup.match(/^commit;$/gm)||[]).length,1);
});
test("enabled undated release uses the same schema and signup path",()=>{
 const undated=prepareMemberSignupArtifacts(enabledRelease);
 assert.match(undated.policySql,/,true\);/);
 assert.doesNotMatch(undated.documentSource,/"stage"|test-v1/);
 const dated=prepareMemberSignupArtifacts({...enabledRelease,termsEffectiveDate:"2099-06-01",privacyEffectiveDate:"2099-05-01"});
 assert.equal(dated.policySql,undated.policySql,"UI date metadata cannot change DB schema, stored snapshots or availability");
 assert.match(dated.policySql,/values\('signup-v1','terms-v1','privacy-v1'/,"date changes must not silently change document versions");
});
test("artifact generation validates versions and dates independently of availability",()=>{
 for(const change of [{termsEffectiveDate:""},{privacyEffectiveDate:"2099-02-30"},{collectionVersion:"invalid'"}]){
  assert.throws(()=>prepareMemberSignupArtifacts({...enabledRelease,...change}));
 }
 const unpublished=prepareMemberSignupArtifacts({...enabledRelease,registrationEnabled:false});
 assert.match(unpublished.policySql,/,false\);/);
});
