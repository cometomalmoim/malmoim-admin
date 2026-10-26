// Local generation only. No database, Auth, network or deployment access.
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {runInNewContext} from "node:vm";
import ts from "typescript";
export function prepareMemberSignupArtifacts(configuration){
const releaseModule={exports:{}};
runInNewContext(ts.transpileModule(readFileSync("src/lib/member-registration-release.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:releaseModule,exports:releaseModule.exports});
const release=configuration??releaseModule.exports.memberRegistrationRelease;
const validDate=value=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
if(typeof release.registrationEnabled!=="boolean")throw new Error("Explicit technical availability required");
for(const key of ["collectionVersion","termsVersion","privacyVersion"])if(!/^[a-zA-Z0-9_-]{1,100}$/.test(release[key]))throw new Error("Invalid release version");
for(const key of ["termsEffectiveDate","privacyEffectiveDate"])if(release[key]!==null&&!validDate(release[key]))throw new Error("Invalid effective date");
const directory="docs/legal-review/20261021";
const manifest=JSON.parse(readFileSync(`${directory}/manifest.json`,"utf8"));
for(const file of manifest.files){
 if(createHash("sha256").update(readFileSync(`${directory}/${file.name}`)).digest("hex")!==file.sha256)throw new Error("Reviewed source changed: "+file.name);
}
const markdownModule={exports:{}};
runInNewContext(ts.transpileModule(readFileSync("src/lib/member-legal-markdown.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:markdownModule,exports:markdownModule.exports});
const documents={};

for(const kind of ["privacy","terms"]){
 const sources={};
 for(const locale of ["ko","en"]){
  let text=readFileSync(`${directory}/${kind}.${locale}.md`,"utf8").replace(/\r\n/g,"\n");
  // This explicitly marked INTERNAL annotation is kept in the original and audit.
  // Article 7's public clauses, including its outstanding disclosures, stay intact.
  if(kind==="privacy"){
   const notes=text.split("\n").filter(line=>line.startsWith(locale==="ko"?"**운영 확인 필요:**":"**Operational verification required:**"));
   if(notes.length!==1)throw new Error("Expected one reviewed internal annotation");
   text=text.replace(notes[0]+"\n","");
  }
  const placeholder=locale==="ko"?"[최종 승인 후 기재]":"[To be entered after final approval]";
  if(text.split(placeholder).length!==2)throw new Error("Expected one effective-date placeholder");
  // Extract the date footer into metadata; preserve every substantive clause.
  sources[locale]=text.split("\n").filter(line=>!line.includes(placeholder)).join("\n");
 }
 documents[kind]=markdownModule.exports.prepareMemberLegalDocument(sources.ko,sources.en,release[kind+"Version"],release[kind+"EffectiveDate"]);
}
const publicationModule={exports:{}};
runInNewContext(ts.transpileModule(readFileSync("src/lib/member-legal.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:publicationModule,exports:publicationModule.exports,Date,require:id=>{if(id==="./member-registration-release")return {memberRegistrationRelease:release};if(id!=="./member-legal-documents")throw new Error("Unexpected publication import");return {memberLegalDocuments:documents};}});
const publication=publicationModule.exports.memberLegalCandidate;

// Store the presented clauses and versions, without date-management metadata.
const snapshot=document=>Object.fromEntries(Object.entries(document).filter(([key])=>key!=="effectiveDate"));
const literal=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
const policySql=`-- Registration bundle: document versions, content snapshots and availability.
-- Technical availability only; no effective date or legal approval is inferred.
insert into public.member_registration_policies(collection_version,terms_version,privacy_version,collection_basis,terms_snapshot,privacy_snapshot,collection_snapshot,enabled)
values('${publication.collection.version}','${publication.terms.version}','${publication.privacy.version}','${publication.collection.basis}',
${literal(snapshot(publication.terms))},
${literal(snapshot(publication.privacy))},
${literal(publication.collection)},${release.registrationEnabled});
create or replace function public.member_registration_ready() returns text
language sql stable security definer set search_path='' as $$
 select collection_version from public.member_registration_policies where enabled
$$;
revoke all on function public.member_registration_ready() from public,anon,authenticated;
`;
const documentSource='// Generated document candidates; this file does not grant publication approval.\n// Versions and nullable dates come from member-registration-release.ts.\nimport type {MemberLegalDocument} from "./member-legal";\nexport const memberLegalDocuments:Record<"privacy"|"terms",MemberLegalDocument> = '+JSON.stringify(documents,null,2)+';\n';
return {documentSource,policySql};
}
