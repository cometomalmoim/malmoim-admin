// Read-only privilege/ownership assertions; no SET ROLE or data changes.
const fs=require('node:fs'),{connect}=require('../install-local.cjs');
try{const root='/private/tmp/malmoim-photo-package-KCloOQ',c=connect(root);if(c.t.dbPort!==60422||c.t.projectId!=='malmoim-photo-package-e118b7ab')throw Error('target');c.sql(fs.readFileSync(__dirname+'/008_verify.read-only.sql','utf8'));
 const roles=['photo_finish_worker','authenticated','anon','photo_storage_issuer','photo_storage_finalizer'];let denied=0;
 for(const role of roles){const out=c.sql("BEGIN READ ONLY;SELECT NOT has_function_privilege('"+role+"','photo_finish_v2.revalidate_generation(jsonb,jsonb)','EXECUTE') AND NOT has_function_privilege('"+role+"','photo_finish_v2.recovery_state(uuid,uuid,uuid)','EXECUTE') AND NOT has_table_privilege('"+role+"','photo_finish_v2.receipt_generations','SELECT,INSERT,UPDATE,DELETE');ROLLBACK;");if(out!=='t')throw Error('excess privilege');denied++;}
 // Actual restricted worker connection: fixed forbidden RPC, then direct write in a
 // read-only transaction. No role escalation, schema change, or source table changes.
 const pw=fs.readFileSync(root+'/verified-finalization/photo_finish_worker.private','utf8').trim();
 for(const q of ["SELECT photo_finish_v2.revalidate_generation('{}'::jsonb,'{}'::jsonb);","INSERT INTO photo_finish_v2.receipt_generations SELECT * FROM photo_finish_v2.receipt_generations WHERE false;"]){
  let rejected=false;try{c.docker(['exec','-i','supabase_db_'+c.t.projectId,'sh','-c','read -r PGPASSWORD; export PGPASSWORD; exec psql -h 127.0.0.1 -X -qAt -U photo_finish_worker -d postgres -v ON_ERROR_STOP=1'],pw+'\nBEGIN READ ONLY;'+q+'ROLLBACK;');}catch{rejected=true;}if(!rejected)throw Error('worker privilege escape');denied++;
 }
 console.log(JSON.stringify({readOnlyCatalogVerified:true,denials:denied,workerOnlyCommit:true}));
}catch{console.error('generation_privilege_audit_failed');process.exitCode=1;}
