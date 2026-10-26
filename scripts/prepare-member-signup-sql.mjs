// Local preparation only: no database connection or deployment.
import {readFileSync,writeFileSync} from "node:fs";
import {prepareMemberSignupArtifacts} from "./member-signup-policy.mjs";
import {createHash} from "node:crypto";
const files=["supabase/drafts/20261016_member_profiles_review.sql","supabase/drafts/20261020_member_nickname_consent_review.sql","supabase/drafts/20261023_member_signup_auth_profile.sql"];
const sources=files.map(file=>({file,sql:readFileSync(file,"utf8")}));
for(const {file,sql} of sources)if((sql.match(/^begin;\s*$/gm)||[]).length!==1||(sql.match(/^commit;\s*$/gm)||[]).length!==1)throw new Error("Unexpected transaction structure: "+file);
const header=`-- MEMBER SIGNUP: single initial installation transaction. Manual execution only.
-- Registration uses document versions and snapshots; no effective-date columns.
-- Signup availability reflects the explicit registrationEnabled configuration.
-- Source drafts below are inputs, not additional installation steps.
-- First inspect 20261022_member_signup_preflight.sql results. This candidate requires
-- profiles/languages/registration objects to be ABSENT and existing board aliases to match.
-- No account, member profile, post, comment, event, or admin record is deleted.
-- Existing schemas are never recreated. Any collision aborts the entire transaction.
${sources.map(({file,sql})=>"-- Source: "+file+" sha256="+createHash("sha256").update(sql).digest("hex")).join("\n")}
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
do $setup_preflight$
begin
 if not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then raise exception 'Reviewed BYPASSRLS owner required';end if;
 if to_regclass('public.board_aliases') is null or to_regclass('auth.users') is null then raise exception 'Existing Auth/board prerequisites missing';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('member_profiles','member_languages','member_registration_policies','member_policy_acceptances','member_signup_requests')) then raise exception 'Existing signup tables: prepare a metadata-specific additive change instead';end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'member_registration%' or p.proname like 'save_member_%' or p.proname like 'member_nickname_%' or p.proname in ('member_profile_protect','member_language_count_check'))) then raise exception 'Existing signup functions: stop, do not overwrite';end if;
end $setup_preflight$;
`;
const bodies=sources.map(({sql})=>sql.replace(/^begin;\s*$/m,"").replace(/^commit;\s*$/m,""));
// The historical profile draft allowed a nullable DOB while policy was pending.
// The released signup schema requires DOB and enforces age at the table trigger too.
bodies[0]=bodies[0].replace("birth_date date check","birth_date date not null check")
 .replace("new.birth_date > (current_timestamp at time zone 'Asia/Seoul')::date","new.birth_date > ((current_timestamp at time zone 'Asia/Seoul')::date-interval '19 years')::date")
 .replace("Birth date cannot be in the future","Member must be at least 19");
const artifacts=prepareMemberSignupArtifacts();
// Historical drafts are composed into one installer; remove obsolete phase notes.
const obsolete=/deliberately cannot enable registration|consent persistence is pending|Required\/optional collection policy is not approved|Before activation: insert approved consent acceptance|Intentionally insert NO policy|NO signup flag|need a separately reviewed activation/;
for(let i=0;i<bodies.length;i++)bodies[i]=bodies[i].split("\n").filter(line=>!obsolete.test(line)).join("\n");
writeFileSync("src/lib/member-legal-documents.ts",artifacts.documentSource);
writeFileSync("supabase/manual/20261022_member_signup_setup.sql",header+bodies.slice(0,2).join("\n")+"\n"+artifacts.policySql+"\n"+bodies[2]+"\ncommit;\n");
