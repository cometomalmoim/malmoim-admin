import 'server-only';
import {getAdminAccess} from './auth';import {createClient} from './supabase/server';import {validId} from './participation-validation';
export type Person={id:string;name:string;contact:string;contact_type:string;application_count:number;confirmed_count:number;attendance_count:number;test_attendance_count:number;session_count:number;test_session_count:number;last_attended_date:string|null};
export type Participation={source:string;application_id:string;event_id:string;person_id:string;confirmation:string;attendance:string;note:string;revision:number;updated_at:string};
export async function participationData(slug?:string,source?:string,id?:string,q='',person?:string){
 if((await getAdminAccess()).status!=='admin')return {error:true as const};
 if((id&&!validId(id))||(person&&!validId(person)))return {missing:true as const};
 try{const client=await createClient();let peopleRequest=client.from('event_person_overview').select('*').order('name').limit(50);
 const search=q.slice(0,100).replace(/[^\p{L}\p{N}\s+@_-]/gu,'').trim();if(search)peopleRequest=peopleRequest.or(`name.ilike.%${search}%,contact.ilike.%${search}%`);
 const people=await peopleRequest;if(people.error)return {error:true as const};
 let application;let current;let event;let profile;let datedMode=false;
 if(slug){const result=await client.from('recruitment_events').select('id,slug,title,is_test,starts_at').eq('slug',slug).maybeSingle();if(result.error)return {error:true as const};if(!result.data)return {missing:true as const};event=result.data;const sessions=await client.from('event_sessions').select('id').eq('event_id',event.id).limit(1);if(sessions.error)return {error:true as const};datedMode=!!sessions.data.length;
 const app=await client.from('event_application_list').select('id,source,event_id,name,contact,contact_type').eq('event_id',event.id).eq('source',source!).eq('id',id!).maybeSingle();if(app.error)return {error:true as const};if(!app.data)return {missing:true as const};application=app.data;
 const link=await client.from('event_participation').select('*').eq('source',source!).eq('application_id',id!).maybeSingle();if(link.error)return {error:true as const};current=link.data as Participation|null;person=current?.person_id??person;}
 if(person){const result=await client.from('event_person_overview').select('*').eq('id',person).maybeSingle();if(result.error)return {error:true as const};profile=result.data as Person|null;if(!profile)return {missing:true as const};}
 const historyResult=profile?await client.from('event_participation').select('*,recruitment_events(title,slug,is_test,starts_at)').eq('person_id',profile.id).order('updated_at',{ascending:false}):null;
 const sessionHistory=profile?await client.from('event_person_session_history').select('*',{count:'exact'}).eq('person_id',profile.id).order('session_date',{ascending:false}).order('session_id').limit(100):null;
 if(historyResult?.error||sessionHistory?.error)return {error:true as const};
 return {ready:true as const,people:people.data as Person[],datedMode,application,current,event,profile,history:historyResult?.data??[],sessionHistory:sessionHistory?.data??[],sessionHistoryCount:sessionHistory?.count??0};
 }catch{return {error:true as const};}
}
