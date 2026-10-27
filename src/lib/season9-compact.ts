import {season9GenderInput} from './season9-gender';
export const compactSeason9Notice='season9-2026-10-27-optional-gender-v2';
export function compactSeason9Input(form:FormData,year=new Date().getUTCFullYear()){
 const read=(key:string)=>String(form.get(key)??'').trim();
 const kind=read('application_kind'),name=read('name'),nationality=read('nationality'),birth=read('birth_year'),group=read('preferred_class');
 const type=read('contact_type'),contact=read('contact');
 if(!['new','returning'].includes(kind)||!name||name.length>100||!['thursday','saturday'].includes(group))return null;
 if(type==='phone'?!/^\+?[0-9]{8,15}$/.test(contact.replace(/[\s()-]/g,'')):type!=='instagram'||!/^@?[A-Za-z0-9_.]{1,30}$/.test(contact))return null;
 if(kind==='new'&&(!nationality||nationality.length>100||!/^\d{4}$/.test(birth)||Number(birth)<1900||Number(birth)>year))return null;
 if(!['privacy_consent','fee_confirmed','photo_consent'].every(key=>form.get(key)==='on'))return null;
 const profile=season9GenderInput(form);if(!profile)return null;
 const id=read('submission_id');if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)||read('website'))return null;
 const payload:Record<string,unknown>={submission_id:id,gender:profile.gender,application_kind:kind,name,nationality:kind==='new'?nationality:null,birth_year:kind==='new'?Number(birth):null,contact,contact_type:type,preferred_class:group,notice_version:compactSeason9Notice,privacy_consent:true,fee_confirmed:true,photo_consent:true};
 for(const key of ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'])payload[key]=read(key).slice(0,150)||null;
 return payload;
}
