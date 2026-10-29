import "server-only";
import { createClient } from "./supabase/server";
import { getAdminAccess } from "./auth";
import { uuid, type CommunityQuery, type CommunityList, type CommunityDetail } from "./community-board-model";
export async function communityList(query: CommunityQuery, admin=false): Promise<CommunityList | null> {
 if(admin&&(await getAdminAccess()).status!=="admin")return null;
 try { const client=await createClient();const result=await client.rpc("member_board_list",{p_filter:admin?query:{...query,category:"notice"},p_admin:admin});return result.error?null:result.data as CommunityList; }catch{return null;}
}
export async function communityDetail(id: string,admin=false,page=1,search=""): Promise<{data:CommunityDetail|null;unavailable:boolean}> {
 if(!uuid(id))return {data:null,unavailable:false};
 if(admin&&(await getAdminAccess()).status!=="admin")return {data:null,unavailable:true};
 try {const client=await createClient();const result=await client.rpc("member_board_detail",{p_id:id,p_admin:admin,p_page:page,p_query:search.slice(0,100)});return {data:result.error?null:result.data as CommunityDetail|null,unavailable:!!result.error};}catch{return {data:null,unavailable:true};}
}
export async function communityIdentity() {
 try{const client=await createClient();const {data:{user},error}=await client.auth.getUser();return error?null:user;}catch{return null;}
}
