'use server';
import {getAdminAccess} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {uuid,communitySaveError} from '@/lib/community-board-model';
import {photoExtension} from '@/lib/people-photo';
import sharp from 'sharp';
import {revalidatePath,updateTag} from 'next/cache';
import {redirect} from 'next/navigation';
export async function saveNotice(_previous:{message:string},form:FormData):Promise<{message:string}>{
 if((await getAdminAccess()).status!=='admin')return {message:'관리자 권한이 필요합니다.'};
 const title=String(form.get('title')??'').trim(),content=String(form.get('content')??'').trim(),language=String(form.get('language')??'');
 const id=String(form.get('id')??''),version=String(form.get('version')??''),nonce=String(form.get('nonce')??'');
 const kept=form.getAll('kept_images').map(String),files=form.getAll('images').filter((file):file is File=>file instanceof File&&file.size>0);
 if(!title||title.length>200||!content||content.length>20000||!['ko','en'].includes(language)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(title+content))return {message:'언어·제목·본문과 글자 수를 확인해주세요.'};
 if(!uuid(nonce)||(id&&(!uuid(id)||!Number.isFinite(Date.parse(version)))))return {message:'저장 정보를 확인하지 못했습니다. 입력 내용을 보관하고 새로고침해주세요.'};
 if(kept.length+files.length>4||new Set(kept).size!==kept.length||files.reduce((sum,file)=>sum+file.size,0)>4*1024*1024)return {message:'사진은 최대 4장, 새 파일 합계 4MB까지 첨부할 수 있습니다. 한 장은 3MB 이하로 선택해주세요.'};
 const client=await createClient(),uploaded:string[]=[];let committed=false;
 try{
  const {data:{user}}=await client.auth.getUser();if(!user)return {message:'로그인 상태를 확인해주세요.'};
  let old:string[]=[];
  if(id){const row=await client.from('board_posts').select('images,updated_at').eq('id',id).eq('category','notice').neq('status','deleted').single();if(row.error)return {message:'공지 조회 권한을 확인해주세요.'};old=row.data.images;}
  if(kept.some(path=>!old.includes(path)))return {message:'기존 첨부 사진을 확인해주세요.'};
  const prepared=await Promise.all(files.map(async file=>{const bytes=new Uint8Array(await file.arrayBuffer());photoExtension(bytes,file.type);return sharp(bytes,{limitInputPixels:30000000}).rotate().resize({width:1920,height:1920,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();}));
  for(const bytes of prepared){if(bytes.length>4*1024*1024)throw new Error('사진 크기를 줄여 다시 선택해주세요.');const path=`${user.id}/${crypto.randomUUID()}.webp`;const result=await client.storage.from('announcement-images').upload(path,bytes,{contentType:'image/webp',upsert:false});if(result.error)throw new Error('사진 업로드를 완료하지 못했습니다. 다시 시도해주세요.');uploaded.push(path);}
  const result=await client.rpc('save_notice',{p_id:id||null,p_version:id?version:null,p_title:title,p_content:content,p_language:language,p_images:[...kept,...uploaded],p_nonce:nonce});
  if(result.error)return {message:communitySaveError(result.error.code,'ko')};
  if(!uuid(String(result.data)))return {message:'저장 결과를 확인하지 못했습니다. 목록을 확인해주세요.'};
  committed=true;const removed=old.filter(path=>!kept.includes(path));if(removed.length){try{await client.storage.from('announcement-images').remove(removed);}catch{/* Unlinked images stay private if cleanup is temporarily unavailable. */}}
 }catch(error){return {message:error instanceof Error?error.message:'저장하지 못했습니다. 입력 내용은 유지됩니다.'};}
 finally{if(!committed&&uploaded.length){try{await client.storage.from('announcement-images').remove(uploaded);}catch{/* Private orphan only; never report a save success. */}}}
 updateTag('public-announcements');revalidatePath('/board','layout');revalidatePath('/en/board','layout');revalidatePath('/admin/member-board');if(id)revalidatePath('/admin/member-board/'+id);
 redirect('/admin/member-board');
}
