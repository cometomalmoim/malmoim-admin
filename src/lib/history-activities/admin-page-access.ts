import type {Access} from '@/lib/auth';
import {isPhotoLabRequest} from './development-target';
export type PhotoPageAccess='disabled'|'anonymous'|'denied'|'error'|'admin';
/** No preview-cookie fallback and no caller-supplied actor or administrator flag.
 * A real admin_users check remains mandatory. Production/other hosts do no IO. */
export async function historyPhotoPageAccess(nodeEnv:string|undefined,host:string|null,authorize:()=>Promise<Access>):Promise<PhotoPageAccess>{
 if(!isPhotoLabRequest(nodeEnv,host))return 'disabled';
 try{return (await authorize()).status;}catch{return 'error';}
}
