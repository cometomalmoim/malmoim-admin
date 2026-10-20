"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccess } from "@/lib/auth";
import { parsePublicLocale, localizedPublicPath } from "@/lib/public-locale";
import { boardText, communityInput, communitySaveError, uuid, type CommunityActionState } from "@/lib/community-board-model";

export async function mutateCommunity(_previous: CommunityActionState,form:FormData):Promise<CommunityActionState>{
 const locale=parsePublicLocale(form.get("locale"));
 const t=(ko:string,en:string)=>boardText(locale,ko,en);
 const action=String(form.get("action")??""),id=String(form.get("id")??""),version=String(form.get("version")??"");
 const admin=form.get("admin")==="true"||["hide_post","show_post","hide_comment","show_comment","pin","report_review"].includes(action);
 let destination:string|null=null;
 try{
  const client=await createClient();
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user)return {message:t("로그인 후 이용해주세요.","Please log in to continue.")};
  if(admin&&(await getAdminAccess()).status!=="admin")return {message:t("관리자 권한이 필요합니다.","Administrator access is required.")};
  if((id&&!uuid(id))||(!id&&!["post_save","comment_save"].includes(action)))throw new Error("validation");
  if(id&&action!=="report"&&(!version||!Number.isFinite(Date.parse(version))))throw new Error("validation");
  const input=communityInput(action,form,admin);
  if(id&&["post_save","post_delete","comment_save","comment_delete"].includes(action)){
   const check=await client.rpc("member_board_can_change",{p_kind:action.startsWith("post")?"post":"comment",p_id:id});
   if(check.error||check.data!==true)return {message:t("작성자 권한을 확인할 수 없습니다.","You cannot change this content.")};
  }
  const nonce=String(form.get("nonce")??"");
  if(!id&& !uuid(nonce))throw new Error("validation");
  const result=await client.rpc("member_board_mutate",{p_action:action,p_id:id||null,p_version:version||null,p_input:input,p_nonce:uuid(nonce)?nonce:null});
  if(result.error)return {message:communitySaveError(result.error.code,locale)};
  if(!uuid(String(result.data)))return {message:t("저장 결과를 확인하지 못했습니다. 새로고침 후 확인해주세요.","Could not verify the saved result. Refresh before retrying.")};
  const base=admin?"/admin/member-board":localizedPublicPath("/board",locale);
  if(action==="post_save")destination=base+"/"+result.data;
  if(action==="post_delete")destination=base;
 }catch(error){
  return {message:error instanceof Error&&error.message==="validation"?t("입력 내용과 글자 수를 확인해주세요.","Check the input and character limits."):t("요청을 처리하지 못했습니다. 입력 내용은 유지됩니다.","Could not process the request. Your input has been kept.")};
 }
 revalidatePath("/board","layout");revalidatePath("/en/board","layout");revalidatePath("/admin/member-board","layout");
 if(destination)redirect(destination);
 return {message:t("처리했습니다.","Saved."),success:true};
}
export async function recordCommunityView(id:string){
 if(!uuid(id))return;
 try{const client=await createClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)return;await client.rpc("member_board_mutate",{p_action:"view",p_id:id});}catch{/* Anonymous/unavailable views are not counted. */}
}
