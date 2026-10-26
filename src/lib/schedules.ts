import 'server-only';
import { createClient } from './supabase/server';
import { getAdminAccess } from './auth';
import type { ScheduleData } from './schedule-types';
import { visibleEventSchedules } from './schedule-visibility';
export async function getSchedules():Promise<ScheduleData|null> {
  if((await getAdminAccess()).status!=='admin')return null;
  try {
    const client=await createClient();
    // Page explicitly: Supabase's default response limit must not hide busy months.
    async function all<T>(query:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:unknown}>):Promise<T[]>{
      const rows:T[]=[];
      for(let from=0;;from+=500){const result=await query(from,from+499);if(result.error||!result.data)throw new Error('Schedule query failed');rows.push(...result.data);if(result.data.length<500)return rows;}
    }
    const [schedules,tags,people,events]=await Promise.all([
      // Agenda spans all months; the calendar filters these same rows to each week.
      all((from,to)=>client.from('schedules').select('*').is('hidden_at',null).order('id').range(from,to)),
      all((from,to)=>client.from('schedule_tags').select('id,name,color,system_key,version').order('sort_order').order('name').order('id').range(from,to)),
      all((from,to)=>client.from('admin_profiles').select('user_id,display_name').order('display_name').order('user_id').range(from,to)),
      all((from,to)=>client.from('recruitment_events').select('id,slug').eq('is_test',false).eq('is_archived',false).order('id').range(from,to)),
    ]);
    return {schedules:visibleEventSchedules(schedules as ScheduleData['schedules'],events),tags,people,events} as ScheduleData;
  }catch{return null;}
}
