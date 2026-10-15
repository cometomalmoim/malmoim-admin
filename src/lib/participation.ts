import 'server-only';
import {getAdminAccess} from './auth';import {createClient} from './supabase/server';import {validId} from './participation-validation';
export type Person={id:string;name:string;contact:string;contact_type:string;application_count:number;confirmed_count:number;attendance_count:number;test_attendance_count:number};
export type Participation={source:string;application_id:string;event_id:string;person_id:string;confirmation:string;attendance:string;note:string;revision:number;updated_at:string};
export async function participationData(slug?:string,source?:string,id?:string,q='',person?:string){
 if((await getAdminAccess()).status!=='admin')return {error:true as const};
 if((id&&!validId(id))||(person&&!validId(person)))return {missing:true as const};
 try{const client=await createClient();let peopleRequest=client.from('event_person_totals').select('*').order('name').limit(50);
 const search=q.slice(0,100).replace(/[^\p{L}\p{N}\s+@_-]/gu,'').trim();if(search)peopleRequest=peopleRequest.or(`name.ilike.%${search}%,contact.ilike.%${search}%`);
 const people=await peopleRequest;if(people.error)return {error:true as const};
 let application;let current;let event;let profile;
 if(slug){const result=await client.from('recruitment_events').select('id,slug,title,is_test,starts_at').eq('slug',slug).maybeSingle();if(result.error)return {error:true as const};if(!result.data)return {missing:true as const};event=result.data;
 const app=await client.from('event_application_list').select('id,source,event_id,name,contact,contact_type').eq('event_id',event.id).eq('source',source!).eq('id',id!).maybeSingle();if(app.error)return {error:true as const};if(!app.data)return {missing:true as const};application=app.data;
 const link=await client.from('event_participation').select('*').eq('source',source!).eq('application_id',id!).maybeSingle();if(link.error)return {error:true as const};current=link.data as Participation|null;person=current?.person_id??person;}
 if(person){const result=await client.from('event_person_totals').select('*').eq('id',person).maybeSingle();if(result.error)return {error:true as const};profile=result.data as Person|null;if(!profile)return {missing:true as const};}
 const historyResult=profile?await client.from('event_participation').select('*,recruitment_events(title,slug,is_test,starts_at)').eq('person_id',profile.id).order('updated_at',{ascending:false}):null;
 if(historyResult?.error)return {error:true as const};
 return {ready:true as const,people:people.data as Person[],application,current,event,profile,history:historyResult?.data??[]};
 }catch{return {error:true as const};}
}
