import 'server-only';
import {cookies,headers} from 'next/headers';
import type {Access} from '@/lib/auth';
import {developmentBroker,developmentPhotoCookie} from './development-storage';
import {isPhotoLabRequest} from './development-target';
/** Transport for the EXISTING isolated Supabase session. No new identity/grant.
 * Broker must getUser() and SELECT the caller's admin_users row on every request.
 * No application-environment credentials or shared admin/login helpers are changed. */
export async function developmentAdminAccess():Promise<Access>{
 if(!isPhotoLabRequest(process.env.NODE_ENV,(await headers()).get('host')))return {status:'error'};
 const session=(await cookies()).get(developmentPhotoCookie)?.value;
 if(!session)return {status:'anonymous'};
 try{return await developmentBroker<Access>({op:'page_access',session});}catch{return {status:'error'};}
}
