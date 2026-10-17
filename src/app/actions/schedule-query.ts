'use server';
import { getSchedules } from '@/lib/schedules';
import { getAdminAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
export async function loadScheduleData(){return getSchedules();}
export async function scheduleRealtimeToken(){
 if((await getAdminAccess()).status!=='admin')return null;
 const client=await createClient();const {data}=await client.auth.getSession();
 return data.session?.access_token??null;
}
