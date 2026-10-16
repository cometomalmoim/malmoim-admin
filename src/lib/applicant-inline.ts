import type {ApplicationRow} from './recruitment';
export const inlineApplicantFields=['name','contact','birth_year','nationality','status','payment_status','internal_note'] as const;
export type InlineApplicantField=typeof inlineApplicantFields[number];
export function applicantEditData(row:ApplicationRow,field:InlineApplicantField,value:string){
 if(!inlineApplicantFields.includes(field))throw new Error('invalid_field');
 const data=new FormData();
 for(const [key,item]of Object.entries({id:row.id,source:row.source,revision:row.revision,name:row.name,contact:row.contact,contact_type:row.contact_type,birth_year:row.birth_year??'',nationality:row.nationality??'',status:row.status,payment_status:row.payment_status,internal_note:row.internal_note,source_note:row.source_note??''}))data.set(key,String(item));
 data.set(field,value);return data;
}
