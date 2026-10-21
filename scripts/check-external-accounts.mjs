import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
nextEnv.loadEnvConfig(process.cwd(),true);
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if(!url||!key)throw new Error('Supabase public connection settings are missing.');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});
// Anonymous probes, no records requested and no valid write operation submitted.
const checks=[
  ['account metadata schema',()=>db.from('external_accounts').select('id,created_by,manager_person_id').limit(0)],
  ['audit schema',()=>db.from('account_access_logs').select('id,account_id,actor_id,changes').limit(0)],
  ['manage RPC signature',()=>db.rpc('manage_external_account',{p_id:null,p_version:null,p_input:{},p_ciphertext:null,p_delete:null})],
  ['reveal RPC signature',()=>db.rpc('reveal_external_account',{p_id:'00000000-0000-0000-0000-000000000000',p_action:'diagnostic-invalid'})],
];
let ready=true;
for(const [name,run] of checks){const {error}=await run();if(error&&error.code!=='42501')ready=false;console.log(JSON.stringify({check:name,code:error?.code??'OK',message:error?.message??'No error',details:error?.details??null,hint:error?.code==='42501'?null:error?.hint??null}));}
console.log('42501 is expected for an anonymous probe of a protected object. PGRST202/205 or 42703 indicate missing/outdated schema. No authenticated save was tested.');
process.exitCode=ready?0:1;
