"use server";
import {getAdminAccess} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function inspectReviewMember(user:string,person:string){
 if((await getAdminAccess()).status!=='admin')return {error:'관리자 권한이 필요합니다.'};
 if(!uuid.test(user)||!uuid.test(person))return {error:'회원 ID·참가자 ID는 올바른 UUID를 입력해주세요.'};
 try {const db=await createClient();const {data,error}=await db.rpc('history_admin_review_context',{p_user:user,p_person:person});
 return error||!data?{error:'회원·참가 정보를 조회하지 못했습니다. 후기 설치 및 관리자 조회 RPC 설치 상태를 확인해주세요.'}:{data};
 }catch{return {error:'연결 오류로 조회하지 못했습니다. 승인하지 않았습니다.'};}
}
export async function manageReviewMember(input:{user:string;person:string;action:string;revision:number;identity:boolean;source:string;application:string;reason:string}){
 if((await getAdminAccess()).status!=='admin')return {error:'관리자 권한이 필요합니다.'};
 if(!uuid.test(input.user)||!uuid.test(input.person)||!['approve','revoke'].includes(input.action)||!Number.isInteger(input.revision)||input.revision<0||!input.reason.trim()||input.reason.trim().length>2000)return {error:'승인 요청과 사유를 확인해주세요.'};
 if(input.action==='approve'&&(!input.identity||!uuid.test(input.application)||!['season9','registration','manual'].includes(input.source)))return {error:'회원 신원 확인과 유효한 참가 근거를 선택해주세요.'};
 try {const db=await createClient();const {data,error}=await db.rpc('history_manage_participant',{p_user:input.user,p_person:input.person,p_action:input.action,p_revision:input.revision,p_identity_confirmed:input.identity,p_source:input.source,p_application:input.application||null,p_reason:input.reason.trim()});
 return error||!Number.isInteger(data)?{error:'승인·철회 결과를 확인하지 못했습니다. 중복 실행하지 말고 정보를 다시 조회하세요. 참가 근거·기존 연결·현재 버전을 확인해주세요.'}:{revision:data as number};
 }catch{return {error:'연결 오류입니다. 결과를 다시 조회한 뒤 진행해주세요.'};}
}
