import 'server-only';
import {getAdminAccess}from './auth';
import {createClient}from './supabase/server';
import {summarizeAcquisition,monthlyAcquisition,type MarketingApplication,type MarketingParticipation,type MarketingEvent,type MonthlyAttendance}from './marketing-comparison';
import {koreanDate}from './participation-rate';
export async function getDashboardAcquisition(events:MarketingEvent[]){
 if((await getAdminAccess()).status!=='admin')return null;
 try{
  const client=await createClient(),applications:MarketingApplication[]=[],participation:MarketingParticipation[]=[],attendance:MonthlyAttendance[]=[];
  for(let start=0;start<events.length;start+=100){
   const batch=events.slice(start,start+100),ids=batch.map(row=>row.id),slugs=batch.map(row=>row.slug);
   await Promise.all([
    (async()=>{for(let offset=0;;offset+=100){const result=await client.from('event_application_admin_list').select('id,event_id,source,utm_source,created_at').eq('is_archived',false).in('event_id',ids).order('event_id').order('source').order('id').range(offset,offset+99);if(result.error)throw new Error('applications');applications.push(...result.data);if(result.data.length<100)break;}})(),
    (async()=>{for(let offset=0;;offset+=100){const result=await client.from('event_participation').select('event_id,source,application_id,confirmation,attendance').in('event_id',ids).order('event_id').order('source').order('application_id').range(offset,offset+99);if(result.error)throw new Error('participation');participation.push(...result.data);if(result.data.length<100)break;}})(),
    (async()=>{for(let offset=0;;offset+=100){const result=await client.from('event_person_session_history').select('event_slug,source,application_id,person_id,session_date,session_id').eq('is_test',false).eq('attendance','attended').in('event_slug',slugs).lte('session_date',koreanDate()).order('session_id').order('source').order('application_id').range(offset,offset+99);if(result.error)throw new Error('attendance');attendance.push(...result.data.map(row=>({...row,event_id:batch.find(event=>event.slug===row.event_slug)!.id})));if(result.data.length<100)break;}})(),
   ]);
  }
  return {...summarizeAcquisition(applications,participation),monthly:monthlyAcquisition(applications,attendance)};
 }catch{return null;}
}
