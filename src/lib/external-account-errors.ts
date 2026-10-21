import {randomUUID} from 'node:crypto';
type DbError={code?:string;message?:string;details?:string|null;hint?:string|null};
export function logExternalAccountError(operation:string,error:DbError,secrets:string[]=[]) {
  const reference=randomUUID();
  const clean=(value:string|null|undefined)=>{
    if(!value)return value??null;
    let text=value.replace(/Failing row contains[\s\S]*/gi,'Failing row contains [REDACTED].').replace(/Key \(([^)]+)\)=\([\s\S]*?\)/g,'Key ($1)=([REDACTED])');
    for(const secret of secrets)if(secret)text=text.split(secret).join('[REDACTED]');
    return text;
  };
  console.error('[external-accounts] Database operation failed', {operation,reference,code:error.code??null,message:clean(error.message),details:clean(error.details),hint:clean(error.hint)});
  return reference;
}
export function externalAccountErrorMessage(error:DbError,reference:string) {
  const suffix=` (오류 참조: ${reference})`;
  if(['42703','42P01','PGRST202','PGRST204','PGRST205'].includes(error.code??''))return '외부 계정 DB 스키마가 앱과 일치하지 않습니다. Supabase에서 supabase/manual/repair_external_accounts.sql을 실행해주세요.'+suffix;
  if(error.code==='23502')return '필수 입력값이 누락되었습니다. 입력값과 DB 필수 컬럼 설정을 확인해주세요.'+suffix;
  if(error.code==='23503')return '선택한 담당자가 더 이상 유효하지 않습니다. 새로고침 후 다시 선택해주세요.'+suffix;
  if(error.code==='23514'||error.code==='22P02'||error.code==='22007')return '입력 형식이 DB 조건에 맞지 않습니다. 금액·날짜·카테고리를 확인해주세요.'+suffix;
  if(error.code==='42501'||error.message==='Forbidden')return '관리자 권한 또는 DB 권한 정책을 확인해주세요. 최신 외부 계정 마이그레이션이 필요할 수 있습니다.'+suffix;
  if(error.message==='Stale account')return '다른 운영진이 계정을 수정했습니다. 새로고침 후 다시 저장해주세요.'+suffix;
  return '저장하지 못했습니다. 서버 터미널에서 오류 참조 번호에 해당하는 DB 오류를 확인해주세요.'+suffix;
}
