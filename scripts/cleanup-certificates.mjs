// Optional scheduled runner: Node >=22.18 (native TypeScript stripping).
// Credentials come only from the scheduler secret store / an ignored local file.
import {createClient} from '@supabase/supabase-js';
import {validateSupabaseConfig} from '../src/lib/supabase/config.ts';
import {cleanCertificateFiles} from '../src/lib/certificate-cleanup.ts';
async function main(){
 const {url,key}=validateSupabaseConfig(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{nodeEnv:process.env.NODE_ENV,localTest:process.env.SUPABASE_LOCAL_TEST});
 if(url!=='http://127.0.0.1:54321' && url!=='http://127.0.0.1:54321/' && process.env.CERTIFICATE_MAINTENANCE_ALLOW_CLOUD!=='true')throw new Error('target_not_approved');
 const email=process.env.CERTIFICATE_MAINTENANCE_EMAIL,password=process.env.CERTIFICATE_MAINTENANCE_PASSWORD;
 if(!email||!password)throw new Error('missing_credentials');
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 try{
  const auth=await db.auth.signInWithPassword({email,password});if(auth.error)throw new Error('auth_failed');
  const admin=await db.from('admin_users').select('user_id').eq('user_id',auth.data.user.id).maybeSingle();
  if(admin.error||!admin.data)throw new Error('forbidden');
  let total=0;
  for(let i=0;i<20;i++){const result=await cleanCertificateFiles(db);total+=result.removed;if(!result.removed)break;}
  console.log('Certificate expired-file cleanup completed. Processed expired entries:',total);
 }finally{await db.auth.signOut({scope:'local'});}
}
main().catch(()=>{console.error('Certificate cleanup failed. Check target, authentication, permissions and Storage availability. No credentials logged.');process.exitCode=1;});
