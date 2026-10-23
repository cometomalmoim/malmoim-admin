import 'server-only';
import {verifyPhotoAdministrator} from './server-admin';
import {createClient} from '../supabase/server';
/** Server-only current request. getSession alone is not an authority; identity/admin
 * are checked through the existing getUser + admin_users implementation on both sides. */
export async function getPhotoAdministratorSession():Promise<{session:string}|null>{
 try{
  const actor=await verifyPhotoAdministrator();if(!actor)return null;
  const client=await createClient(),{data,error}=await client.auth.getSession();
  if(error||data.session?.user.id!==actor.actorId||!data.session.access_token)return null;
  if((await verifyPhotoAdministrator())?.actorId!==actor.actorId)return null;
  return {session:data.session.access_token};
 }catch{return null;}
}
