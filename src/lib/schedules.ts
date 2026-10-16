import 'server-only';
import { createClient } from './supabase/server';
import { getAdminAccess } from './auth';
import { monthGrid } from './schedule-calendar';
import type { ScheduleData } from './schedule-types';
export async function getSchedules(month?:string):Promise<ScheduleData|null> {
  if((await getAdminAccess()).status!=='admin')return null;
  try {
    const client=await createClient(), grid=monthGrid(month);
    // Page explicitly: Supabase's default response limit must not hide busy months.
    async function all<T>(query:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:unknown}>):Promise<T[]>{
      const rows:T[]=[];
      for(let from=0;;from+=500){const result=await query(from,from+499);if(result.error||!result.data)throw new Error('Schedule query failed');rows.push(...result.data);if(result.data.length<500)return rows;}
    }
    const [schedules,tags,people,events]=await Promise.all([
      all((from,to)=>client.from('schedules').select('*').is('hidden_at',null).lte('start_date',grid.end).gte('end_date',grid.start).order('id').range(from,to)),
      all((from,to)=>client.from('schedule_tags').select('id,name,color,system_key,version').order('sort_order').order('name').order('id').range(from,to)),
      all((from,to)=>client.from('admin_profiles').select('user_id,display_name').order('display_name').order('user_id').range(from,to)),
      all((from,to)=>client.from('recruitment_events').select('id,slug').eq('is_test',false).order('id').range(from,to)),
    ]);
    return {schedules,tags,people,events} as ScheduleData;
  }catch{return null;}
}
