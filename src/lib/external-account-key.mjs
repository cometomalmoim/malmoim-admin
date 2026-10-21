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
  /** @param {string} reason @param {string} [message] @returns {never} */
  function fail(reason,message='계정 암호화 키 설정을 확인해주세요.') {
    // Do not include environment values, ciphertext, passwords or raw exception messages.
    report(`[external-accounts] ${EXTERNAL_ACCOUNT_KEY_NAME}: ${reason}`);
    throw new Error(message);
  }
  const configured=env[EXTERNAL_ACCOUNT_KEY_NAME]?.trim();
  if(configured) {
    if(!valid(configured))return fail('invalid format; expected exactly 64 hexadecimal characters (32 bytes). 암호화 키 형식 오류: 32바이트 키를 64자리 hex로 설정해주세요.',`서버 암호화 키(${EXTERNAL_ACCOUNT_KEY_NAME}) 형식이 잘못되었습니다. 64자리 hex 설정을 확인해주세요.`);
    return Buffer.from(configured,'hex');
  }
  if(!['development','test'].includes(env.NODE_ENV??'')) {
    const state=env[EXTERNAL_ACCOUNT_KEY_NAME]===undefined?'undefined':'empty';
    return fail(`missing (${state}); 프로덕션 환경 변수 [${EXTERNAL_ACCOUNT_KEY_NAME}]이 설정되지 않았습니다. 배포 서버에 기존 데이터와 동일한 64자리 hex 키를 등록하고 재배포해주세요. 개발용 키 파일은 프로덕션에서 사용하지 않습니다.`,`서버 암호화 키(${EXTERNAL_ACCOUNT_KEY_NAME})가 설정되지 않았습니다. 배포 환경 변수 설정 후 재배포해주세요.`);
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
