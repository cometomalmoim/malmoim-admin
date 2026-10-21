import {randomBytes} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

export const EXTERNAL_ACCOUNT_KEY_NAME='EXTERNAL_ACCOUNTS_ENCRYPTION_KEY';
export const EXTERNAL_ACCOUNT_LOCAL_KEY_FILE='.env.external-accounts.key';
const valid=value=>/^[a-f\d]{64}$/i.test(value);

/**
 * Persist a random development key across requests/restarts. Never use a shared default key.
 * @param {{env?:Record<string,string|undefined>,directory?:string,report?:(message:string)=>void}} options
 * @returns {Buffer}
 */
export function resolveExternalAccountKey({env=process.env,directory=process.cwd(),report=console.error}={}) {
  /** @param {string} reason @returns {never} */
  function fail(reason) {
    // Do not include environment values, ciphertext, passwords or raw exception messages.
    report(`[external-accounts] ${EXTERNAL_ACCOUNT_KEY_NAME}: ${reason}`);
    throw new Error('계정 암호화 키 설정을 확인해주세요.');
  }
  const configured=env[EXTERNAL_ACCOUNT_KEY_NAME]?.trim();
  if(configured) {
    if(!valid(configured))return fail('invalid format; expected exactly 64 hexadecimal characters (32 bytes).');
    return Buffer.from(configured,'hex');
  }
  if(!['development','test'].includes(env.NODE_ENV??'')) {
    return fail('missing; configure the server environment. Automatic local keys are allowed only in development/test.');
  }
  const path=join(directory,EXTERNAL_ACCOUNT_LOCAL_KEY_FILE);
  try {
    // Exclusive creation prevents concurrent workers from replacing each other's key.
    writeFileSync(path,randomBytes(32).toString('hex')+'\n',{flag:'wx',mode:0o600});
  } catch(error) {
    if(error?.code!=='EEXIST')return fail('cannot create the persistent local key file; check workspace write permissions.');
  }
  let stored;
  try {stored=readFileSync(path,'utf8').trim();}
  catch {return fail('cannot read the persistent local key file; check workspace permissions.');}
  if(!valid(stored))return fail('persistent local key file is invalid; restore its backup instead of regenerating it.');
  return Buffer.from(stored,'hex');
}
