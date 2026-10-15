import { getAdminAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { validUuid, validatePdf } from '@/lib/resource-validation';
import { pdfStructure } from '@/lib/pdf-validation';
export const maxDuration=60;
const reply=(message:string,status=400)=>Response.json({message},{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request){
 try{
 // Same-origin mutation only. Never trust a client-supplied identity.
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply('요청 출처를 확인해주세요.',403);
 if((await getAdminAccess()).status!=='admin')return reply('관리자 권한이 필요합니다.',403);
 if(Number(request.headers.get('content-length')??0)>3500000)return reply('파일당 최대 3MB입니다.',413);
 const data=await request.formData();const resource=String(data.get('resource_id')??''),operation=String(data.get('operation')??'');
 if(!validUuid(resource))return reply('자료를 확인해주세요.');
 const client=await createClient();
 const parent=await client.from('resources').select('id').eq('id',resource).maybeSingle();
 if(parent.error||!parent.data)return reply('자료 또는 설정을 확인할 수 없습니다.',404);
 if(operation==='upload'){
 const file=data.get('file');if(!(file instanceof File))return reply('PDF 파일을 선택해주세요.');
 if(file.size>3145728)return reply('파일당 최대 3MB입니다.',413);
 const bytes=new Uint8Array(await file.arrayBuffer());const invalid=validatePdf(file.name,file.type,bytes);if(invalid)return reply(invalid);
 const structure=await pdfStructure(bytes);if(structure)return reply(structure);
 const id=crypto.randomUUID(),path=`${resource}/${id}.pdf`;
 const tracked=await client.from('resource_files').insert({id,resource_id:resource,original_name:file.name.slice(0,200),size_bytes:file.size}).select('id').single();
 if(tracked.error)return reply('등록 한도(5개) 또는 설정을 확인해주세요.');
 const uploaded=await client.storage.from('admin-resources').upload(path,bytes,{contentType:'application/pdf',upsert:false});
 if(uploaded.error)return reply('업로드하지 못했습니다. 남은 작업 기록을 삭제한 뒤 재시도해주세요.');
 const ready=await client.from('resource_files').update({state:'ready'}).eq('id',id);
 if(ready.error)return reply('파일 상태 저장에 실패했습니다. 남은 작업 기록을 삭제하고 재시도해주세요.');
 return reply('파일을 등록했습니다.',200);
 }
 const id=String(data.get('file_id')??'');if(!validUuid(id))return reply('첨부파일을 확인해주세요.');
 const result=await client.from('resource_files').select('*').eq('id',id).eq('resource_id',resource).maybeSingle();
 if(result.error||!result.data)return reply('첨부파일을 찾을 수 없습니다.',404);
 const path=`${resource}/${id}.pdf`;
 if(operation==='download'){
 if(result.data.state!=='ready')return reply('등록이 완료되지 않은 파일입니다.');
 const signed=await client.storage.from('admin-resources').createSignedUrl(path,60,{download:result.data.original_name});
 if(signed.error)return reply('다운로드 주소를 만들지 못했습니다.');
 return Response.json({url:signed.data.signedUrl},{headers:{'Cache-Control':'private, no-store'}});
 }
 if(operation==='delete'){
 if(result.data.state==='pending'&&Date.now()-Date.parse(result.data.created_at)<15*60000)return reply('진행 중인 작업은 15분 후 정리할 수 있습니다.');
 const removed=await client.storage.from('admin-resources').remove([path]);if(removed.error)return reply('파일을 삭제하지 못했습니다. 다시 시도해주세요.');
 const deleted=await client.from('resource_files').delete().eq('id',id);if(deleted.error)return reply('파일 기록 정리를 다시 시도해주세요.');
 return reply('첨부파일을 삭제했습니다.',200);
 }
 return reply('지원하지 않는 요청입니다.');
 }catch{return reply('처리하지 못했습니다. 설정을 확인한 뒤 다시 시도해주세요.',500);}
}
