const fs=require('node:fs'),{connect}=require('../install-local.cjs');
try{
 const root='/private/tmp/malmoim-photo-package-KCloOQ',{t,pin,sql,docker}=connect(root);
 if(t.projectId!=='malmoim-photo-package-e118b7ab'||t.dbPort!==60422)throw Error('wrong target');pin();
 // Preflight existing 003 + 005 owner/ACL/body contracts before any DDL.
 sql(fs.readFileSync(__dirname+'/../receipt-lookup/006_verify.read-only.sql','utf8'));
 const dir=fs.mkdtempSync(root+'/generation-before-');fs.chmodSync(dir,0o700);
 fs.writeFileSync(dir+'/schema.private.sql',docker(['exec','supabase_db_'+t.projectId,'pg_dump','-U','postgres','-d','postgres','--schema-only','--schema=photo_finish_v2','--schema=photo_scope_v3','--schema=photo_service_v4']),{mode:0o600});
 const body=fs.readFileSync(__dirname+'/007_generations.local-approved.sql','utf8').replace(/COMMIT;\s*$/,'');
 const verify=fs.readFileSync(__dirname+'/008_verify.read-only.sql','utf8').replace('BEGIN READ ONLY;','').replace('ROLLBACK;','');
 sql("SET photo_generation.approved='malmoim-photo-package-e118b7ab:60422';\n"+body+verify+'COMMIT;');
 console.log(JSON.stringify({applied:true,project:t.projectId,port:t.dbPort,backup:dir,existingRowsUntouched:true}));
}catch{console.error('generation_overlay_rejected; transaction rolled back');process.exitCode=1;}
