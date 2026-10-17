'use server';
import { getAdminAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { scheduleInput } from '@/lib/schedule-validation';
import { revalidatePath } from 'next/cache';
export async function changeSchedule(data:FormData):Promise<string> {
  if((await getAdminAccess()).status!=='admin')return '관리자 권한을 확인해주세요.';
  try {
    const client=await createClient(), operation=String(data.get('operation')??'save');
    const id=String(data.get('id')??''), version=Number(data.get('version'));
    let result;
    if(operation==='delete') result=await client.rpc('delete_schedule',{p_id:id,p_version:version});
    else {let input;try{input=scheduleInput(data);}catch(error){return error instanceof Error?error.message:'입력 내용을 확인해주세요.';}
      if(input.start_time||input.end_time){const schema=await client.from('schedules').select('start_time,end_time').limit(1);if(schema.error)return '시간 저장을 위해 Supabase에 019_schedule_times.sql을 먼저 적용해주세요.';}
      result=await client.rpc('save_schedule',{p_id:id||null,p_version:version||0,p_input:input});}
    if(result.error)return '저장 실패: 입력값 또는 최신 수정 여부를 확인해주세요.';
    revalidatePath('/admin/schedule'); return '';
  }catch{return '입력 내용과 연결을 확인해주세요.';}
}
export async function changeScheduleTag(data:FormData):Promise<string> {
  if((await getAdminAccess()).status!=='admin')return '관리자 권한을 확인해주세요.';
  try {
    const client=await createClient(); const name=String(data.get('name')??'').trim(),color=String(data.get('color')??'');
    const deleting=data.get('operation')==='delete';
    if(!deleting&&(!name||name.length>30||!/^#[0-9a-f]{6}$/i.test(color)))return '태그 이름과 색상을 확인해주세요.';
    const result=await client.rpc('manage_schedule_tag',{p_id:String(data.get('id')??'')||null,p_version:Number(data.get('version'))||0,p_name:name,p_color:color,p_delete:deleting,p_replacement:String(data.get('replacement')??'')||null});
    if(result.error)return '태그 저장 실패: 중복 이름, 최신 수정 여부, 대체 태그를 확인해주세요.';
    revalidatePath('/admin/schedule');return '';
  }catch{return '연결을 확인하고 다시 시도해주세요.';}
}
