import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
function load(name, mocks = {}) {
  const file = path.resolve(root, name);
  const loaded = { exports: {} };
  const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  runInNewContext(outputText, { module: loaded, exports: loaded.exports, FormData, Date, Intl, console, ...mocks.__globals, process: { env: { NODE_ENV: "test" } },
    require: id => Object.hasOwn(mocks, id) ? mocks[id] : id==="next/navigation"?{useRouter:()=>({refresh:()=>{}})}:
      id.startsWith("@/") ? load("src/" + id.slice(2) + ".ts", mocks) : id.startsWith(".") ? load(path.relative(root, path.resolve(path.dirname(file), id + ".ts")), mocks) : require(id),
  });
  return loaded.exports;
}
const options = load("src/lib/signup-options.ts");
const { validateSignup, readSignupForm } = load("src/lib/signup-validation.ts");
const { registerMember } = load("src/lib/member-registration.ts");
const valid = () => ({
  email: " member@example.test ", password: "test-only-Password1!", passwordConfirmation: "test-only-Password1!",
  nickname:"언어친구",termsConsent:true,termsVersion:"test-terms",privacyVersion:"test-privacy",collectionVersion:"test-policy-only",name: "테스트", callingCode: "82", phoneNumber: "010-0000-0000", nationality: "KR",
  gender: "undisclosed", birthDate: "2000-01-01", koreanLevel: "none", englishLevel: "none",
  foreignLanguages: [{ language: "ja", level: "basic" }], privacyConsent: true,
});
const policy = { minPasswordLength: 8, requiredFields: [], consentVersion: "test-policy-only",termsVersion:"test-terms",privacyVersion:"test-privacy",privacyConsentRequired:true };
const readiness={terms_version:policy.termsVersion,privacy_version:policy.privacyVersion,collection_version:policy.consentVersion,requires_consent:true,enabled:true};
const nicknameTools=load("src/lib/member-nickname.ts");

test("signup is enabled with undated documents; dates are metadata and DB versions must match",()=>{
 const {registrationDocumentsReady,registrationDatabaseReady}=load("src/lib/member-registration-readiness.ts");
 const legal=load("src/lib/member-legal.ts").publishedMemberLegal;
 const configured=load("src/lib/member-registration-policy.ts",{"server-only":{}}).memberRegistrationPolicy;
 assert.equal(registrationDocumentsReady(configured,legal,"2026-01-01"),true);
 assert.equal(legal.terms.effectiveDate,null);assert.equal(legal.terms.version,"terms-v1");
 const dated={...legal,terms:{...legal.terms,effectiveDate:"2099-06-01"},privacy:{...legal.privacy,effectiveDate:"2099-05-01"}};
 assert.equal(registrationDocumentsReady(configured,dated,"2099-05-31"),true);
 assert.equal(registrationDocumentsReady(configured,dated,"2099-06-01"),true);
 assert.equal(registrationDocumentsReady({...configured,privacyVersion:"old"},legal),false);
 assert.equal(registrationDocumentsReady(null,legal),false);
 const ready={terms_version:configured.termsVersion,privacy_version:configured.privacyVersion,collection_version:configured.consentVersion,requires_consent:false,enabled:true};
 assert.equal(registrationDatabaseReady(ready,configured),true);
 for(const data of [null,[],{},"ready",{...ready,enabled:false},{...ready,terms_version:"old"},{...ready,privacy_version:"old"},{...ready,collection_version:"old"},{...ready,requires_consent:true}])assert.equal(registrationDatabaseReady(data,configured),false);
});

test("checked-in release enables signup immediately without approval flags or a date",()=>{
 const release=load("src/lib/member-registration-release.ts").memberRegistrationRelease;
 assert.equal(release.registrationEnabled,true);assert.equal("termsApproved" in release,false);assert.equal("privacyApproved" in release,false);
 assert.equal(release.termsEffectiveDate,null);assert.equal(release.privacyEffectiveDate,null);
 const mocks={"server-only":{}};
 assert.ok(load("src/lib/member-legal.ts",mocks).publishedMemberLegal);
 assert.ok(load("src/lib/member-registration-policy.ts",mocks).memberRegistrationPolicy);
 const disabled={...release,registrationEnabled:false};
 assert.equal(load("src/lib/member-registration-policy.ts",{...mocks,"./member-registration-release":{memberRegistrationRelease:disabled}}).memberRegistrationPolicy,null);
});

test("approved required-only registration saves the displayed document versions atomically",async()=>{
 const configured=load("src/lib/member-registration-policy.ts",{"server-only":{}}).memberRegistrationPolicy;
 const input={...valid(),name:"",phoneNumber:"",nationality:"",gender:"",foreignLanguages:[],privacyConsent:false,termsVersion:configured.termsVersion,privacyVersion:configured.privacyVersion,collectionVersion:configured.consentVersion};
 const {api}=backend();let saved;
 api.auth.getUser=async()=>({data:{user:{id:"user-a"}},error:null});
 api.rpc=async(name,args)=>{
  if(name==="save_member_registration_v2")saved=args;
  return {data:name==="member_registration_v2_ready"?{enabled:true,terms_version:configured.termsVersion,privacy_version:configured.privacyVersion,collection_version:configured.consentVersion,requires_consent:false}:name==="member_nickname_available"?true:"user-a",error:null};
 };
 assert.equal((await registerMember(input,api,configured)).status,"complete");
 assert.equal(saved.p_terms_accepted,true);assert.equal(saved.p_collection_accepted,false);
 assert.equal(saved.p_terms_version,input.termsVersion);assert.equal(saved.p_privacy_version,input.privacyVersion);
 assert.equal(saved.p_profile.name,null);assert.equal(saved.p_profile.phone_number,null);assert.equal(saved.p_languages.length,0);
 for(const change of [{name:"forged"},{phoneNumber:"01000000000"},{nationality:"KR"},{gender:"undisclosed"},{foreignLanguages:[{language:"ja",level:"basic"}]}]){
  const {api,calls}=backend();assert.equal((await registerMember({...input,...change},api,configured,"en")).status,"invalid");assert.equal(calls.length,0);
 }
});

test("required-only form keeps nickname, age, languages and legal links while omitting unconfirmed optional collection",()=>{
 const React=require("react"),{renderToStaticMarkup}=require("react-dom/server");
 const {SignupForm}=load("src/components/signup-form.tsx",{"next/link":{__esModule:true,default:"a"},"@/app/actions/member-registration":{signup:()=>assert.fail("Render must not create an account")},"./signup-legal-notice":{SignupLegalNotice:()=>null}});
 const html=renderToStaticMarkup(React.createElement(SignupForm,{countries:[],today:"2026-10-22",locale:"en",registrationEnabled:true,collectOptionalProfile:false}));
 for(const field of ["nickname","email","birthDate","koreanLevel","englishLevel"])assert.ok(html.includes(`name="${field}"`));
 for(const field of ["name","phoneNumber","nationality","gender","foreignLanguage"])assert.ok(!html.includes(`name="${field}"`));
 assert.match(html,/>Sign up<\/button>/);assert.doesNotMatch(html,/운영 정책|기본 정보의 수집/);
});

test("released signup form is enabled without a preparation banner or redundant render-time database probe",async()=>{
 const legal=load("src/lib/member-legal.ts").publishedMemberLegal;
 const configured=load("src/lib/member-registration-policy.ts",{"server-only":{}}).memberRegistrationPolicy;
 const tools=load("src/lib/member-registration-readiness.ts");
 for(const ready of [null,{enabled:true,terms_version:configured.termsVersion,privacy_version:configured.privacyVersion,collection_version:configured.consentVersion,requires_consent:false}]){
  const {MemberSignupPage}=load("src/components/member-signup-page.tsx",{
   "next/server":{connection:async()=>{}},"next/link":{__esModule:true,default:"a"},
   "@/lib/member-registration-policy":{memberRegistrationPolicy:configured},
   "@/lib/member-registration-readiness":{...tools,registrationDocumentsReady:(policy,publication)=>tools.registrationDocumentsReady(policy,publication,"2026-10-22")},
   "@/lib/supabase/server":{createClient:async()=>({auth:{getUser:async()=>({data:{user:null},error:null})},rpc:()=>assert.fail("DB readiness is checked by submission, not by rendering")})},
   "./signup-form":{SignupForm:"TestSignupForm"},"@/app/(public)/signup/signup.css":{},
  });
  const page=MemberSignupPage({locale:"en"}),child=page.props.children.at(-1).props.children;
  const form=await child.type(child.props);
  assert.equal(form.props.registrationEnabled,true);assert.equal(form.props.collectOptionalProfile,false);
  assert.equal(form.props.legal.terms.version,legal.terms.version);
  assert.equal(form.type,"TestSignupForm");assert.ok(ready===null||ready.collection_version===configured.consentVersion);
 }
});
test("nicknames normalize before validation and reject invalid/reserved names in both languages",()=>{
 assert.equal(nicknameTools.normalizeNickname("  Ｎａｍｅ_한글  "),"Name_한글");
 assert.equal(nicknameTools.nicknameKey("Name_한글"),nicknameTools.nicknameKey("ｎａｍｅ_한글"));
 assert.equal(nicknameTools.nicknameError("언어친구"),null);
 assert.equal(nicknameTools.nicknameError("a".repeat(20)),null);
 for(const name of ["","a","a".repeat(21),"two words","<script>","admin_123","관리자님","시스템","말모임공식","Former_Member","탈퇴한_회원"]){
  assert.ok(nicknameTools.nicknameError(name));assert.doesNotMatch(nicknameTools.nicknameError(name,"en"),/[가-힣]/);
 }
});
test("age 19 is required, allowed on the birthday, and evaluated at Seoul day boundaries",()=>{
 const check=(birthDate,today)=>validateSignup({...valid(),birthDate},{today});
 assert.ok(check("2007-10-20","2026-10-20").profile);
 assert.ok(check("2007-10-21","2026-10-20").errors.birthDate);
 assert.ok(check("","2026-10-20").errors.birthDate);
 assert.ok(check("2008-02-29","2027-02-28").errors.birthDate);
 assert.ok(check("2008-02-29","2027-03-01").profile);
 assert.ok(check("2007-10-20",options.getTodayInKorea(new Date("2026-10-19T14:59:59Z"))).errors.birthDate);
 assert.ok(check("2007-10-20",options.getTodayInKorea(new Date("2026-10-19T15:00:00Z"))).profile);
});
test("missing/forged consent versions and underage profiles stop before storage or account creation",async()=>{
 for(const change of [{termsConsent:false},{privacyConsent:false},{termsVersion:"forged"},{privacyVersion:"forged"},{collectionVersion:"forged"},{nickname:""},{birthDate:"9999-01-01"}]){
  const {api,calls}=backend();const result=await registerMember({...valid(),...change},api,policy,"en");
  assert.equal(result.status,"invalid");assert.equal(calls.length,0);assert.doesNotMatch(result.message,/[가-힣]/);
 }
});
test("nickname availability and concurrent unique violations never claim registration success",async()=>{
 const {api,calls}=backend();
 api.rpc=async name=>({data:name==="member_registration_v2_ready"?readiness:false,error:null});
 assert.equal((await registerMember(valid(),api,policy)).status,"invalid");assert.equal(calls.some(([n])=>n==="signUp"),false);
 api.rpc=async name=>({data:name==="member_registration_v2_ready"?readiness:null,error:name==="member_registration_v2_ready"?null:{code:"PGRST202"}});
 assert.equal((await registerMember(valid(),api,policy)).status,"blocked");
 api.auth.getUser=async()=>({data:{user:{id:"user-a"}},error:null});
 api.rpc=async name=>({data:name==="member_registration_v2_ready"?readiness:true,error:name==="save_member_registration_v2"?{code:"23505"}:null});
 const raced=await registerMember(valid(),api,policy,"en");assert.equal(raced.status,"profile_pending");assert.match(raced.errors.nickname,/already in use/);
});
test("contract-based collection does not manufacture privacy consent; terms acceptance stays required",async()=>{
 const {api}=backend();api.auth.getUser=async()=>({data:{user:{id:"user-a"}},error:null});
 let saved;
 api.rpc=async(name,args)=>{if(name==="save_member_registration_v2")saved=args;return {data:name==="member_registration_v2_ready"?{...readiness,requires_consent:false}:name==="member_nickname_available"?true:"user-a",error:null};};
 assert.equal((await registerMember({...valid(),privacyConsent:false},api,{...policy,privacyConsentRequired:false})).status,"complete");
 assert.equal(saved.p_collection_accepted,false);assert.equal(saved.p_terms_accepted,true);assert.equal(saved.p_nickname,"언어친구");
 assert.equal(saved.p_terms_version,policy.termsVersion);assert.equal(saved.p_privacy_version,policy.privacyVersion);
});
test("board display uses only the public alias and an explicit former-member marker",()=>{
 assert.equal(nicknameTools.communityAuthorName("언어친구","en"),"언어친구");
 assert.equal(nicknameTools.communityAuthorName("Member-legacy","ko"),"Member-legacy");
 assert.equal(nicknameTools.communityAuthorName("탈퇴한 회원","en"),"Former Member");
 assert.equal(nicknameTools.communityAuthorName("old nickname","ko",true),"탈퇴한 회원");
 assert.equal(nicknameTools.communityAuthorName(null,"en"),"Member");
});
test("privacy route withholds internal drafts and only renders an approved effective date/content",()=>{
 const React=require("react"),{renderToStaticMarkup}=require("react-dom/server");
 const {MemberLegalContent}=load("src/components/member-legal-content.tsx",{"./member-legal.css":{}});
 const render=(publication,locale)=>{
  const {MemberLegalPage}=load("src/components/member-legal-page.tsx",{"next/link":{__esModule:true,default:"a"},"./member-privacy.css":{},"./member-legal-content":{MemberLegalContent},"@/lib/member-legal":{getPublishedMemberDocument:()=>publication?.privacy??null}});
  return renderToStaticMarkup(React.createElement(MemberLegalPage,{locale,kind:"privacy"}));
 };
 const pending=render(null,"en");assert.match(pending,/Publication is being prepared/);assert.doesNotMatch(pending,/TODO|확인 필요|Effective date|시행일/);
 const policy={version:"synthetic",effectiveDate:"2026-10-20",sections:[{id:"purpose",title:{ko:"목적",en:"Purpose"},paragraphs:{ko:["승인 테스트"],en:["Approved fixture only"]}}]};
 const approved=render({privacy:policy},"en");assert.match(approved,/datetime="2026-10-20"/i);assert.match(approved,/Approved fixture only/);assert.match(approved,/href="#purpose"/);
 assert.equal(localeTools.publicLocaleDecision("/privacy","en").pathname,"/en/privacy");
});
test("terms and collection consent remain separate, unchecked, versioned and unavailable before approval",()=>{
 const React=require("react"),{renderToStaticMarkup}=require("react-dom/server");
 const {MemberLegalContent}=load("src/components/member-legal-content.tsx",{"./member-legal.css":{}});
 const {MemberLegalModal}=load("src/components/member-legal-modal.tsx",{"./member-legal-content":{MemberLegalContent}});
 const {SignupLegalNotice}=load("src/components/signup-legal-notice.tsx",{"./member-legal-modal":{MemberLegalModal}});
 const doc={version:"fixture-v1",effectiveDate:"2026-10-20",sections:[]};
 const text={ko:"가상 테스트",en:"Synthetic test"};
 const legal={privacy:doc,terms:doc,collection:{version:"collection-fixture",basis:"consent",purpose:text,items:text,retention:text,refusal:text}};
 const render=(publication,enabled)=>renderToStaticMarkup(React.createElement(SignupLegalNotice,{legal:publication,enabled,locale:"en",errors:{}}));
 const pending=render(null,false);assert.match(pending,/disabled=""/);assert.doesNotMatch(pending,/checked=""|TODO|확정 대기/);
 const consent=render(legal,true);assert.match(consent,/name="termsConsent"/);assert.match(consent,/name="privacyConsent"/);assert.match(consent,/name="termsVersion"/);assert.doesNotMatch(consent,/checked=""/);
 const contract=render({...legal,collection:{...legal.collection,basis:"contract"}},true);assert.doesNotMatch(contract,/name="privacyConsent"/);assert.match(contract,/name="termsConsent"/);
 assert.match(consent,/aria-haspopup="dialog"/);assert.match(consent,/Read full Privacy Policy/);assert.match(consent,/Read full Terms of Service/);
 assert.doesNotMatch(consent,/target="_blank"|<details|<a /);
});
test("legal modal locks scrolling, focuses its title and restores the trigger and prior overflow on close",()=>{
 const React=require("react");let effect,refIndex=0;
 const events=[];
 class Element {isConnected=true;focus(){events.push("trigger-focus");}}
 const trigger=new Element();
 const dialog={showModal:()=>events.push("show"),close:()=>events.push("close")};
 const title={focus:()=>events.push("title-focus")},body={scrollTop:420};
 const page={body:{style:{overflow:"scroll"}},activeElement:trigger};
 const {MemberLegalModal}=load("src/components/member-legal-modal.tsx",{
  react:{...React,useRef:()=>({current:[dialog,title,body][refIndex++]}),useId:()=>"fixture",useEffect:fn=>{effect=fn;}},
  "./member-legal-content":{MemberLegalContent:()=>null},__globals:{window:{document:page},HTMLElement:Element},
 });
 const element=MemberLegalModal({open:true,onClose:()=>{},document:null,locale:"ko",kind:"privacy"});
 assert.equal(element.type,"dialog");assert.equal(element.props["aria-labelledby"],"fixture-title");assert.equal(element.props["aria-modal"],"true");
 const cleanup=effect();assert.equal(page.body.style.overflow,"hidden");assert.equal(body.scrollTop,0);assert.deepEqual(events,["show","title-focus"]);
 cleanup();assert.equal(page.body.style.overflow,"scroll");assert.deepEqual(events,["show","title-focus","close","trigger-focus"]);
});
test("legal modal handles Escape and backdrop only; its controls never submit the signup form",()=>{
 const React=require("react");let closed=0;
 const {MemberLegalModal}=load("src/components/member-legal-modal.tsx",{
  react:{...React,useRef:()=>({current:null}),useId:()=>"fixture",useEffect:()=>{}},
  "./member-legal-content":{MemberLegalContent:()=>null},
 });
 const element=MemberLegalModal({open:true,onClose:()=>closed++,document:null,locale:"en",kind:"terms"});
 let prevented=false;element.props.onCancel({preventDefault:()=>{prevented=true;}});assert.equal(prevented,true);assert.equal(closed,1);
 const currentTarget={getBoundingClientRect:()=>({left:100,right:500,top:100,bottom:500})};
 const click=(x,y,target=currentTarget)=>element.props.onClick({target,currentTarget,clientX:x,clientY:y});
 click(200,200);click(0,0,{});assert.equal(closed,1);click(50,200);assert.equal(closed,2);
 const buttons=[];const walk=node=>{if(!node||typeof node!=="object")return;if(node.type==="button")buttons.push(node);React.Children.forEach(node.props?.children,walk);};walk(element);
 assert.equal(buttons.length,2);for(const button of buttons){assert.equal(button.props.type,"button");button.props.onClick();}assert.equal(closed,4);
});
test("shared legal content renders approved bilingual text with isolated anchors and no unpublished legal claims",()=>{
 const React=require("react"),{renderToStaticMarkup}=require("react-dom/server");
 const {MemberLegalContent}=load("src/components/member-legal-content.tsx",{"./member-legal.css":{}});
 const doc={version:"fixture-only",effectiveDate:"2026-10-21",sections:[{id:"purpose",title:{ko:"목적",en:"Purpose"},paragraphs:{ko:["승인된 가상 문서"],en:["Approved synthetic document"]}}]};
 for(const locale of ["ko","en"]){
  const content=renderToStaticMarkup(React.createElement(MemberLegalContent,{document:doc,locale,idPrefix:"modal-"}));
  assert.match(content,/href="#modal-purpose"/);assert.match(content,/id="modal-purpose"/);assert.match(content,/2026-10-21/);assert.ok(content.includes(doc.sections[0].paragraphs[locale][0]));
  const pending=renderToStaticMarkup(React.createElement(MemberLegalContent,{document:null,locale,kind:"terms"}));
  assert.doesNotMatch(pending,/fixture-only|2026-10-21|TODO|확인 필요/);
 }
});
function backend(overrides = {}) {
  const calls = [];
  const api = {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      signUp: async input => {
        calls.push(["signUp", input]);
        return { data: { user: { id: "user-a" }, session: {} }, error: null };
      },
    },
    rpc: async (name, args) => {
      calls.push([name, args]);
      return { data: name === "member_registration_v2_ready" ? readiness : name==="member_nickname_available"?true:"user-a", error: null };
    },
    ...overrides,
  };
  return { api, calls };
}
test("countries are unique ISO alpha-2 codes; Korean and foreign levels stay separate", () => {
  assert.equal(options.COUNTRY_CODES.length, 249);
  assert.equal(new Set(options.COUNTRY_CODES).size, 249);
  assert.equal(options.KOREAN_LEVELS.length, 5);
  assert.equal(options.ENGLISH_LEVELS.length, 5);
  assert.equal(options.FOREIGN_LEVELS.length, 4);
  assert.ok(!options.FOREIGN_LEVELS.some(level => level.value === "none"));
  assert.ok(!options.FOREIGN_LANGUAGES.some(([code]) => code === "ko" || code === "en"));
});
test("valid form normalizes phone/email without including passwords in profile", () => {
  const result = validateSignup(valid());
  assert.equal(Object.keys(result.errors).length, 0);
  assert.equal(result.profile.email, "member@example.test");
  assert.equal(result.profile.phoneNumber, "1000000000");
  assert.equal("password" in result.profile, false);
  assert.equal("passwordConfirmation" in result.profile, false);
});
test("email, confirmation, dates, country, gender, phone and length are validated", () => {
  for (const change of [
    { email: "bad" }, { email: "a".repeat(255) + "@example.test" }, { passwordConfirmation: "mismatch" },
    { birthDate: "2999-01-01" }, { birthDate: "2023-02-29" }, { birthDate: "0000-01-01" },
    { nationality: "ZZ" }, { gender: "invalid" }, { callingCode: "0" }, { phoneNumber: "abc" },
    { phoneNumber: "1".repeat(20) }, { name: "a".repeat(101) },
  ]) assert.ok(Object.keys(validateSignup({ ...valid(), ...change }).errors).length > 0, JSON.stringify(change));
});
test("unapproved collection requirements are not fabricated; configured requirements apply", () => {
  const input = { ...valid(), name: "", phoneNumber: "", nationality: "", gender: "", birthDate: "2000-01-01" };
  assert.ok(validateSignup(input).profile);
  assert.ok(validateSignup(input, { requiredFields: ["name", "birthDate"] }).errors.name);
  assert.ok(validateSignup({...input,birthDate:""}, { requiredFields: ["name", "birthDate"] }).errors.birthDate);
  assert.ok(validateSignup({ ...valid(), password: "short", passwordConfirmation: "short" }, { minPasswordLength: 8 }).errors.password);
});
test("zero to three additional languages validate; four, duplicates, ko/en and none fail", () => {
  const codes = ["ja", "zh", "fr", "de"];
  for (let size = 0; size <= 3; size++)
    assert.ok(validateSignup({ ...valid(), foreignLanguages: codes.slice(0, size).map(language => ({ language, level: "fluent" })) }).profile);
  for (const foreignLanguages of [
    codes.map(language => ({ language, level: "basic" })),
    [{ language: "ja", level: "basic" }, { language: "ja", level: "native" }],
    [{ language: "ko", level: "native" }], [{ language: "en", level: "native" }],
    [{ language: "ja", level: "none" }], [{ language: "zz", level: "fluent" }],
  ]) assert.equal(validateSignup({ ...valid(), foreignLanguages }).profile, null);
});
test("Korean and English independently accept five levels and require an explicit answer", () => {
  for (const koreanLevel of ["none", "basic", "conversational", "fluent", "native"])
    for (const englishLevel of ["none", "basic", "conversational", "fluent", "native"]) {
      const result = validateSignup({ ...valid(), koreanLevel, englishLevel, foreignLanguages: [] });
      assert.equal(result.profile.koreanLevel, koreanLevel);
      assert.equal(result.profile.englishLevel, englishLevel);
    }
  for (const field of ["koreanLevel", "englishLevel"])
    for (const value of ["", "unknown"]) assert.ok(validateSignup({ ...valid(), [field]: value }).errors[field]);
});
test("server reads all repeated rows including malformed unequal arrays", () => {
  const form = new FormData();
  form.append("foreignLanguage", "en"); form.append("foreignLanguage", "ja"); form.append("foreignLevel", "basic");
  form.set("callingCode", "other"); form.set("customCallingCode", "254");
  const input = readSignupForm(form);
  assert.equal(input.foreignLanguages.length, 2);
  assert.equal(input.foreignLanguages[1].level, "");
  assert.equal(input.callingCode, "254");
});
test("policy gate blocks before contacting Auth or DB", async () => {
  const api = { auth: { getUser: () => assert.fail("Must not contact Auth") }, rpc: () => assert.fail("Must not contact DB") };
  assert.equal((await registerMember(valid(), api, null)).status, "blocked");
  const action = load("src/app/actions/member-registration.ts", {
    "@/lib/supabase/server": { createClient: () => assert.fail("Must not create client") },
    "@/lib/member-registration-policy": { memberRegistrationPolicy: null },
    "@/lib/member-registration": { registerMember },
    "@/lib/signup-validation": { readSignupForm },
  });
  assert.equal((await action.signup(new FormData())).status, "blocked");
});
test("missing migration or consent version blocks before account creation", async () => {
  for (const result of [{ data: null, error: { code: "PGRST202" } }, { data: "wrong", error: null }]) {
    const { api, calls } = backend({ rpc: async () => result });
    assert.equal((await registerMember(valid(), api, policy)).status, "blocked");
    assert.equal(calls.length, 0);
  }
});
test("invalid consent, repeated language or password is rejected server-side", async () => {
  for (const input of [{ ...valid(), privacyConsent: false }, { ...valid(), passwordConfirmation: "bad" },
    { ...valid(), foreignLanguages: Array(6).fill({ language: "en", level: "none" }) }]) {
    const { api, calls } = backend();
    assert.equal((await registerMember(input, api, policy)).status, "invalid");
    assert.equal(calls.length, 0);
  }
});
test("email confirmation without a session never saves a profile or claims completion", async () => {
  const { api, calls } = backend();
  api.auth.signUp = async () => ({ data: { user: { id: "unverified" }, session: null }, error: null });
  const result = await registerMember(valid(), api, policy);
  assert.equal(result.status, "confirmation");
  assert.match(result.message, /아직 저장되지/);
  assert.ok(!calls.some(([name]) => name === "save_member_registration_v2"));
});
test("verified signup uses one atomic profile RPC and sends no password or owner field", async () => {
  const { api, calls } = backend();
  let count = 0;
  api.auth.getUser = async () => ({ data: { user: count++ ? { id: "user-a" } : null }, error: null });
  assert.equal((await registerMember(valid(), api, policy)).status, "complete");
  const writes = calls.filter(([name]) => name === "save_member_registration_v2");
  assert.equal(writes.length, 1);
  const args = writes[0][1];
  assert.equal(args.p_languages.length, 1);
  assert.equal(args.p_profile.korean_proficiency, "none");
  assert.equal(args.p_profile.english_proficiency, "none");
  assert.equal("user_id" in args.p_profile, false);
  assert.equal("password" in args.p_profile, false);
  assert.equal(args.p_profile.phone_number, "1000000000");
});
test("partial failure is explicitly pending and signed-in users can retry without Auth creation", async () => {
  const { api } = backend();
  api.auth.getUser = async () => ({ data: { user: { id: "user-a" } }, error: null });
  api.auth.signUp = () => assert.fail("Must not create another account");
  api.rpc = async name => ({ data: name === "member_registration_v2_ready" ? readiness : name==="member_nickname_available"?true:null,
    error: ["member_registration_v2_ready","member_nickname_available"].includes(name) ? null : { code: "23514" } });
  const input = { ...valid(), email: "", password: "", passwordConfirmation: "" };
  assert.equal((await registerMember(input, api, policy)).status, "profile_pending");
  api.rpc = async name => ({ data: name === "member_registration_v2_ready" ? readiness : name==="member_nickname_available"?true:"user-a", error: null });
  assert.equal((await registerMember(input, api, policy)).status, "complete");
});
test("Auth invalid email identifies the field without exposing provider details", async () => {
  for (const locale of ["ko", "en"]) {
    const { api, calls } = backend();
    const diagnostics = [];
    api.auth.signUp = async () => ({ data: { user: null, session: null }, error: {
      code: "email_address_invalid", status: 400, message: "private-email@example.test rejected; internal provider details",
    } });
    const result = await registerMember(valid(), api, policy, locale, entry => diagnostics.push(entry));
    assert.equal(result.status, "invalid");
    assert.equal(result.errors.email, result.message);
    assert.match(result.message, locale === "ko" ? /다른 이메일 주소/ : /another email address/);
    assert.equal(JSON.stringify(diagnostics), JSON.stringify([{ stage: "auth_signup", code: "email_address_invalid", status: 400 }]));
    assert.doesNotMatch(JSON.stringify({result, diagnostics}), /private-email|internal provider/);
    assert.ok(!calls.some(([name]) => name === "save_member_registration_v2"));
  }
});
test("SMTP restriction is distinct from an invalid email and diagnostics exclude unknown provider data", async () => {
  for (const code of ["email_address_not_authorized", "private-email@example.test"]) {
    const { api } = backend(); const diagnostics = [];
    api.auth.signUp = async () => ({ data: { user: null, session: null }, error: {code, status: 400, message: "private provider message"} });
    const result = await registerMember(valid(), api, policy, "ko", entry => diagnostics.push(entry));
    assert.equal(result.status, "error");
    if (code === "email_address_not_authorized") assert.match(result.message, /발송 설정/);
    assert.equal(diagnostics[0].code, code === "email_address_not_authorized" ? code : "unclassified");
    assert.doesNotMatch(JSON.stringify({result, diagnostics}), /private/);
  }
});
test("diagnostic logging failure cannot change the signup result", async () => {
  const { api } = backend();
  api.auth.signUp = async () => ({ data: { user: null, session: null }, error: {code: "email_address_invalid", status: 400} });
  assert.equal((await registerMember(valid(), api, policy, "ko", () => { throw new Error("logger unavailable"); })).status, "invalid");
});
test("Auth rejection or uncertain identity cannot trigger profile writes", async () => {
  for (const failure of [{ code: "weak_password" }, { status: 429 }, { status: 500 }]) {
    const { api, calls } = backend();
    api.auth.signUp = async () => ({ data: { user: null, session: null }, error: failure });
    assert.equal((await registerMember(valid(), api, policy)).status, "error");
    assert.ok(!calls.some(([name]) => name === "save_member_registration_v2"));
  }
  const { api, calls } = backend();
  assert.equal((await registerMember(valid(), api, policy)).status, "profile_pending");
  assert.ok(!calls.some(([name]) => name === "save_member_registration_v2"));
});

test("duplicate email errors and Auth's obfuscated duplicate response never save another profile",async()=>{
 for(const response of [
  {data:{user:null,session:null},error:{code:"user_already_exists",status:422}},
  {data:{user:null,session:null},error:{code:"email_exists",status:422}},
  {data:{user:{id:"obfuscated",identities:[]},session:null},error:null},
 ]){
  const {api,calls}=backend();api.auth.signUp=async()=>response;
  const result=await registerMember(valid(),api,policy,"en");
  assert.equal(result.status,"invalid");assert.match(result.errors.email,/already registered/);
  assert.equal(calls.some(([name])=>name==="save_member_registration_v2"),false);
 }
});

test("confirmation-enabled signup uses an opaque Auth reference and fails before Auth if preparation is unavailable",async()=>{
 const configured=load("src/lib/member-registration-policy.ts",{"server-only":{}}).memberRegistrationPolicy;
 const input={...valid(),name:"",phoneNumber:"",nationality:"",gender:"",foreignLanguages:[],privacyConsent:false,termsVersion:configured.termsVersion,privacyVersion:configured.privacyVersion,collectionVersion:configured.consentVersion};
 for(const prepared of [{data:null,error:{code:"PGRST202"}},{data:"not-a-token",error:null}]){
  const {api}=backend();let authCalled=false;
  api.rpc=async name=>name==="member_registration_v2_ready"?{data:{enabled:true,terms_version:configured.termsVersion,privacy_version:configured.privacyVersion,collection_version:configured.consentVersion,requires_consent:false},error:null}:name==="member_nickname_available"?{data:true,error:null}:prepared;
  api.auth.signUp=async()=>{authCalled=true;return {data:{user:null,session:null},error:null};};
  assert.equal((await registerMember(input,api,configured)).status,"blocked");assert.equal(authCalled,false);
 }
 const {api}=backend();let authInput,preparedInput;
 api.rpc=async(name,args)=>{
  if(name==="prepare_member_registration")preparedInput=args;
  return {data:name==="member_registration_v2_ready"?{enabled:true,terms_version:configured.termsVersion,privacy_version:configured.privacyVersion,collection_version:configured.consentVersion,requires_consent:false}:name==="member_nickname_available"?true:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",error:null};
 };
 api.auth.signUp=async data=>{authInput=data;return {data:{user:{id:"new-user",identities:[{}]},session:null},error:null};};
 const result=await registerMember(input,api,configured,"en");assert.equal(result.status,"confirmation");assert.match(result.message,/do not need to enter/);
 assert.deepEqual(Object.keys(authInput.options.data),["malmoim_registration_token"]);
 assert.equal("password" in preparedInput,false);assert.equal("password" in preparedInput.p_profile,false);assert.equal("email" in preparedInput.p_profile,false);
 assert.equal(preparedInput.p_terms_accepted,true);assert.equal(preparedInput.p_profile.birth_date,input.birthDate);
});

test("only a verified Auth session allows the UI to retry profile saving without another signup",async()=>{
 const {api}=backend();
 const uncertain=await registerMember(valid(),api,policy);assert.equal(uncertain.status,"profile_pending");assert.notEqual(uncertain.canRetryProfile,true);
 api.auth.getUser=async()=>({data:{user:{id:"user-a"}},error:null});
 api.rpc=async name=>({data:name==="member_registration_v2_ready"?readiness:name==="member_nickname_available"?true:null,error:null});
 const pending=await registerMember(valid(),api,policy);assert.equal(pending.canRetryProfile,true);
 api.rpc=async name=>({data:name==="member_registration_v2_ready"?readiness:null,error:null});
 assert.equal((await registerMember(valid(),api,policy)).status,"blocked");
});
test("existing session network failure stops registration instead of creating an account", async () => {
  const { api, calls } = backend();
  api.auth.getUser = async () => ({ data: { user: null }, error: { name: "AuthRetryableFetchError" } });
  assert.equal((await registerMember(valid(), api, policy)).status, "error");
  assert.equal(calls.length, 0);
});
test("public logout shares local session with a home redirect; admin logout stays separate", async () => {
  const redirects = [];
  const actions = load("src/app/actions/auth.ts", {
    "@/lib/supabase/config": { SupabaseConfigError: class extends Error {} },
    "@supabase/supabase-js": { isAuthRetryableFetchError: () => false },
    "next/navigation": { redirect: path => { redirects.push(path); throw new Error("redirect"); } },
    "@/lib/supabase/server": { createClient: async () => ({ auth: {
      signOut: async ({ scope }) => { assert.equal(scope, "local"); return { error: null }; },
    } }) },
  });
  await assert.rejects(actions.memberLogout(), /redirect/);
  await assert.rejects(actions.logout(), /redirect/);
  assert.deepEqual(redirects, ["/", "/login"]);
});

test("requested password policy rejects each missing character class and passwords under eight", () => {
  for (const password of ["Aa1!bbb", "1234567!", "abcdefgh!", "abcdefgh1", "Abcdef1 ", "Abcdef1한"]) {
    assert.ok(validateSignup({ ...valid(), password, passwordConfirmation: password }).errors.password);
  }
  for (const password of ["abcd123!", "ABC123!?", "Abc 123!"]) {
    assert.ok(validateSignup({ ...valid(), password, passwordConfirmation: password }).profile);
  }
});

test("public account uses a verified server user and fails closed on invalid session", async () => {
  const cookie = { name: "sb-test-auth-token", value: "test-only" };
  const getAccount = async (cookies, result) => {
    let calls = 0;
    const { PublicAccount } = load("src/components/public-account.tsx", {
      "next/headers": { cookies: async () => ({ getAll: () => cookies }) },
      "@/lib/supabase/server": { createClient: async () => { calls++; return { auth: { getUser: async () => result } }; } },
      "./profile-menu": { ProfileMenu: "TestProfile" },
      "next/link": { __esModule: true, default: "a" },
    });
    return { element: await PublicAccount({ locale: "ko" }), calls };
  };
  const anon = await getAccount([], null);
  assert.equal(anon.calls, 0);
  assert.equal(anon.element.props.href, "/auth/login");
  const user = await getAccount([cookie], { data: { user: { email: "test@example.test" } }, error: null });
  assert.equal(user.element.props.email, "test@example.test");
  const denied = await getAccount([cookie], { data: { user: { email: "untrusted@example.test" } }, error: {} });
  assert.equal(denied.element.props.href, "/auth/login");
  assert.equal(denied.element.props.email, undefined);
});
test("homepage now refreshes SSR cookies; admin host redirect and private cache are preserved", async () => {
  let refreshed = 0;
  const response = () => ({ cookies: { set: () => {} }, headers: new Map() });
  const { proxy } = load("src/proxy.ts", {
    "@/lib/domain-routing": { isAdminRoot: (host, path) => host === "admin.malmoim.com" && path === "/" },
    "@/lib/supabase/config": { getSupabaseConfig: () => ({ url: "https://test.invalid", key: "test-only" }) },
    "@supabase/ssr": { createServerClient: (_url, _key, options) => ({ auth: {
      getClaims: async () => { refreshed++; options.cookies.setAll([{ name: "test-only", value: "test", options: {} }]); },
    } }) },
    "next/server": { NextResponse: { next: response, redirect: url => ({ ...response(), destination: url.pathname }) } },
  });
  const request = host => ({ nextUrl: { pathname: "/", clone: () => ({ pathname: "/" }) },
    headers: { get: () => host }, cookies: { getAll: () => [], set: () => {} } });
  const home = await proxy(request("localhost"));
  assert.equal(refreshed, 1);
  assert.match(home.headers.get("Cache-Control"), /private, no-store/);
  const admin = await proxy(request("admin.malmoim.com"));
  assert.equal(admin.destination, "/login");
  assert.equal(refreshed, 1);
});

const localeTools = load("src/lib/public-locale.ts");
test("locale routing preserves corresponding auth pages and excludes admin/independent event pages", () => {
  for (const path of ["/", "/about", "/events", "/exchange", "/board", "/history", "/auth/login", "/signup"]) {
    const enPath = path === "/" ? "/en" : "/en" + path;
    assert.equal(localeTools.localizedPublicPath(path, "en"), enPath);
    assert.equal(localeTools.localizedPublicPath(enPath, "ko"), path);
    assert.equal(localeTools.publicLocaleDecision(path, "en").pathname, enPath);
    assert.equal(localeTools.publicLocaleDecision(enPath, "en", "ko").pathname, path);
    assert.equal(localeTools.publicLocaleDecision(enPath, "ko").locale, "en");
  }
  for (const path of ["/login", "/admin", "/admin/users", "/season9", "/en/season9", "/2026halloweenparty", "/en/missing"])
    assert.equal(localeTools.publicLocaleDecision(path, "en", "en"), null);
  assert.equal(localeTools.parsePublicLocale("https://invalid.test"), "ko");
});
test("English form messages and option labels are localized without changing stored codes", () => {
  const errors = validateSignup({ ...valid(), email: "invalid", password: "x", passwordConfirmation: "",
    nationality: "ZZ", gender: "other", koreanLevel: "", englishLevel: "", birthDate: "2999-01-01",
    foreignLanguages: [{ language: "en", level: "none" }] }, { locale: "en" }).errors;
  assert.ok(Object.keys(errors).length >= 8);
  for (const value of Object.values(errors)) assert.doesNotMatch(value, /[가-힣]/);
  assert.equal(options.getCountryOptions("en").length, 249);
  assert.equal(options.getForeignLanguageOptions("en").length, 35);
  for (const item of [...options.getCountryOptions("en"), ...options.getForeignLanguageOptions("en"), ...options.getCallingCodeOptions("en")])
    assert.doesNotMatch(item.label, /[가-힣]/);
});
test("empty additional-language list and both fixed levels are passed in one atomic RPC", async () => {
  const { api, calls } = backend();
  api.auth.getUser = async () => ({ data: { user: { id: "user-a" } }, error: null });
  api.auth.signUp = () => assert.fail("Existing member must not create another account");
  const input = { ...valid(), koreanLevel: "basic", englishLevel: "none", foreignLanguages: [] };
  assert.equal((await registerMember(input, api, policy, "en")).status, "complete");
  const args = calls.find(([name]) => name === "save_member_registration_v2")[1];
  assert.equal(args.p_profile.korean_proficiency, "basic");
  assert.equal(args.p_profile.english_proficiency, "none");
  assert.equal(args.p_languages.length, 0);
});
test("English signup blocked, confirmation and partial-failure messages stay English", async () => {
  const closed = await registerMember(valid(), backend().api, null, "en");
  assert.equal(closed.status, "blocked");
  assert.doesNotMatch(closed.message, /[가-힣]/);
  const { api } = backend();
  api.auth.signUp = async () => ({ data: { user: { id: "user-a" }, session: null }, error: null });
  const confirmation = await registerMember(valid(), api, policy, "en");
  assert.equal(confirmation.status, "confirmation");
  assert.doesNotMatch(confirmation.message, /[가-힣]/);
  api.auth.getUser = async () => ({ data: { user: { id: "user-a" } }, error: null });
  api.rpc = async name => ({ data: name === "member_registration_v2_ready" ? readiness : name==="member_nickname_available"?true:null,
    error: ["member_registration_v2_ready","member_nickname_available"].includes(name) ? null : { code: "23514" } });
  const pending = await registerMember(valid(), api, policy, "en");
  assert.equal(pending.status, "profile_pending");
  assert.doesNotMatch(pending.message, /[가-힣]/);
});
test("public Auth redirects retain English while admin routes stay fixed", async () => {
  let failure = null;
  const actions = load("src/app/actions/auth.ts", {
    "@/lib/supabase/config": { SupabaseConfigError: class extends Error {} },
    "@supabase/supabase-js": { isAuthRetryableFetchError: () => false },
    "next/navigation": { redirect: path => { throw new Error("REDIRECT:" + path); } },
    "@/lib/supabase/server": { createClient: async () => ({ auth: {
      signInWithPassword: async () => ({ error: failure }), signOut: async () => ({ error: failure }),
    } }) },
  });
  const form = new FormData();
  form.set("email", "test@example.test"); form.set("password", "test-only"); form.set("locale", "en");
  await assert.rejects(actions.memberLogin({}, form), /REDIRECT:\/en$/);
  await assert.rejects(actions.memberLogout({}, form), /REDIRECT:\/en$/);
  await assert.rejects(actions.login({}, form), /REDIRECT:\/admin$/);
  await assert.rejects(actions.logout(), /REDIRECT:\/login$/);
  failure = { status: 400, code: "invalid_credentials" };
  assert.doesNotMatch((await actions.memberLogin({}, form)).message, /[가-힣]/);
  assert.doesNotMatch((await actions.memberLogout({}, form)).message, /[가-힣]/);
  assert.match((await actions.login({}, form)).message, /[가-힣]/);
});
test("proxy persists language selection, redirects only supported GET routes and preserves Auth refresh cookies", async () => {
  function response() { return { cookies: { values: new Map(), set(name, value) { this.values.set(name, value); } }, headers: new Map() }; }
  const { proxy } = load("src/proxy.ts", {
    "@/lib/domain-routing": { isAdminRoot: (host, path) => host === "admin.malmoim.com" && path === "/" },
    "@/lib/supabase/config": { getSupabaseConfig: () => ({ url: "https://test.invalid", key: "test-only" }) },
    "@supabase/ssr": { createServerClient: (_url, _key, options) => ({ auth: { getClaims: async () =>
      options.cookies.setAll([{ name: "sb-test-auth-token", value: "test-only", options: {} }]) } }) },
    "next/server": { NextResponse: { next: response, redirect: url => ({ ...response(), destination: url.pathname, search: url.search }) } },
  });
  function request(path, preference = "en", method = "GET") {
    const url = new URL("https://example.test" + path);
    url.clone = () => new URL(url);
    return { method, nextUrl: url, headers: { get: () => "example.test" },
      cookies: { get: name => name === "malmoim_locale" ? { value: preference } : undefined, getAll: () => [], set: () => {} } };
  }
  const english = await proxy(request("/signup"));
  assert.equal(english.destination, "/en/signup");
  assert.equal(english.cookies.values.get("malmoim_locale"), "en");
  const korean = await proxy(request("/signup?lang=ko"));
  assert.equal(korean.destination, "/signup");
  assert.equal(korean.search, "");
  assert.equal(korean.cookies.values.get("malmoim_locale"), "ko");
  const regular = await proxy(request("/en/auth/login"));
  assert.equal(regular.cookies.values.get("malmoim_locale"), "en");
  assert.equal(regular.cookies.values.get("sb-test-auth-token"), "test-only");
  const admin = await proxy(request("/login?lang=en"));
  assert.equal(admin.destination, undefined);
  assert.equal(admin.cookies.values.has("malmoim_locale"), false);
  const post = await proxy(request("/signup", "en", "POST"));
  assert.equal(post.destination, undefined);
});

test("Korean calendar date changes exactly at Seoul midnight regardless of host timezone", () => {
  const cases = [
    ["2026-10-15T14:59:59.999Z", "2026-10-15"],
    ["2026-10-15T15:00:00.000Z", "2026-10-16"],
    ["2026-12-31T14:59:59.999Z", "2026-12-31"],
    ["2026-12-31T15:00:00.000Z", "2027-01-01"],
    ["2024-02-28T15:00:00.000Z", "2024-02-29"],
  ];
  for (const [instant, expected] of cases) {
    const today = options.getTodayInKorea(new Date(instant));
    assert.equal(today, expected);
    assert.ok(validateSignup({ ...valid(), birthDate: expected }, { today }).errors.birthDate);
  }
  assert.ok(validateSignup({ ...valid(), birthDate: "2026-10-16" },
    { today: options.getTodayInKorea(new Date("2026-10-15T14:59:59.999Z")) }).errors.birthDate);
  assert.ok(validateSignup({ ...valid(), birthDate: "2026-10-16" },
    { today: options.getTodayInKorea(new Date("2026-10-15T15:00:00.000Z")) }).errors.birthDate);
});

test("signup waits for the request before reading time even if Supabase configuration fails", async () => {
  let release;
  let dateReads = 0;
  const connected = new Promise(resolve => { release = resolve; });
  const { MemberSignupPage } = load("src/components/member-signup-page.tsx", {
    "next/server": { connection: () => connected },
    "next/link": { __esModule: true, default: "a" },
    "@/lib/supabase/server": { createClient: async () => { throw new Error("Test configuration unavailable"); } },
    "@/lib/member-registration-policy": { memberRegistrationPolicy: null },
    "@/lib/signup-options": { getCountryOptions: () => [], getTodayInKorea: () => {
      dateReads++; return options.getTodayInKorea(new Date("2026-10-15T15:00:00Z"));
    } },
    "./signup-form": { SignupForm: "TestSignupForm" },
    "@/app/(public)/signup/signup.css": {},
  });
  for (const locale of ["ko", "en"]) {
    const page = MemberSignupPage({ locale });
    const suspense = page.props.children.at(-1);
    const child = suspense.props.children;
    const content = child.type(child.props);
    if (locale === "ko") {
      assert.equal(dateReads, 0);
      release();
    }
    const form = await content;
    assert.equal(form.props.today, "2026-10-16");
    assert.equal(form.props.locale, locale);
  }
  assert.equal(dateReads, 2);
});

test("server ignores a forged client date and rejects future birth before Auth creation or saving", async () => {
  const form = new FormData();
  for (const [key, value] of Object.entries(valid())) {
    if (typeof value === "string") form.set(key, value);
  }
  form.set("birthDate", "9999-12-31");
  form.set("today", "9999-12-31");
  form.set("privacyConsent", "on");
  const input = readSignupForm(form);
  assert.equal("today" in input, false);
  const { api, calls } = backend();
  const result = await registerMember(input, api, policy);
  assert.equal(result.status, "invalid");
  assert.ok(result.errors.birthDate);
  assert.equal(calls.length, 0);
});
