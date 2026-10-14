'use server';
import { getAdminAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { resourceInput, validUuid } from '@/lib/resource-validation';
import { revalidatePath } from 'next/cache';
export type ResourceState={message:string;id?:string;success?:boolean};
export async function saveResource(scopeEventId:string|null,_previous:ResourceState,data:FormData):Promise<ResourceState>{
 if((await getAdminAccess()).status!=='admin')return {message:'관리자 권한을 확인해주세요.'};
 let input;try{input=resourceInput(data);}catch(e){return {message:e instanceof Error?e.message:'입력을 확인해주세요.'};}
 try{
 if(scopeEventId&&input.event_id!==scopeEventId)return {message:'이벤트 범위를 확인해주세요.'};
 const client=await createClient();const id=String(data.get('id')??'');
 if(id&&!validUuid(id))return {message:'자료를 확인해주세요.'};
 if(input.event_id){const event=await client.from('recruitment_events').select('id').eq('id',input.event_id).maybeSingle();if(event.error||!event.data)return {message:'연결 이벤트를 확인할 수 없습니다.'};}
 const result=id?await client.from('resources').update(input).eq('id',id).select('id').single():await client.from('resources').insert(input).select('id').single();
 if(result.error)return {message:'저장하지 못했습니다. 설정과 권한을 확인한 뒤 다시 시도해주세요.'};
 revalidatePath('/admin');return {message:'자료 정보를 저장했습니다. 첨부파일은 별도로 등록해주세요.',id:result.data.id,success:true};
 }catch{return {message:'연결하지 못했습니다. 입력을 유지한 채 다시 시도해주세요.'};}
}
export async function deleteResource(id:string):Promise<ResourceState>{
 if(!validUuid(id)||(await getAdminAccess()).status!=='admin')return {message:'관리자 권한과 자료를 확인해주세요.'};
 try{
 const client=await createClient();const files=await client.from('resource_files').select('id,state,created_at').eq('resource_id',id);
 if(files.error)return {message:'첨부파일 정보를 확인하지 못했습니다.'};
 if(files.data.some(f=>f.state==='pending'&&Date.now()-Date.parse(f.created_at)<15*60000))return {message:'진행 중인 파일 작업이 있습니다. 15분 후 다시 시도해주세요.'};
 for(const file of files.data){const removed=await client.storage.from('admin-resources').remove([`${id}/${file.id}.pdf`]);if(removed.error)return {message:'일부 파일을 삭제하지 못했습니다. 자료 정보는 유지됩니다. 다시 시도해주세요.'};const row=await client.from('resource_files').delete().eq('id',file.id);if(row.error)return {message:'파일 기록 정리를 다시 시도해주세요.'};}
 const removed=await client.from('resources').delete().eq('id',id).select('id').single();
 if(removed.error)return {message:'자료 삭제에 실패했습니다. 다시 시도해주세요.'};
 revalidatePath('/admin');return {message:'자료를 삭제했습니다.',success:true};
 }catch{return {message:'삭제를 완료하지 못했습니다. 다시 시도해주세요.'};}
}
