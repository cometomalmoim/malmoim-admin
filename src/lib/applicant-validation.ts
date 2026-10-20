export const applicationStatuses={received:'접수',reviewing:'검토 중',accepted:'합격',waitlisted:'대기',declined:'불합격',withdrawn:'취소'};
export const paymentStatuses={unknown:'미확인',unpaid:'미입금',paid:'입금 완료',refunded:'환불'};
export function applicantInput(data:FormData){
 const text=(key:string,max:number,required=false)=>{const value=String(data.get(key)??'').trim();if(value.length>max||(required&&!value))throw new Error('invalid');return value;};
 const source=text('source',20,true),id=text('id',36),name=text('name',100,true),contact=text('contact',200,true),contact_type=text('contact_type',20,true),nationality=text('nationality',100),note=text('internal_note',3000),source_note=text('source_note',1000),status=text('status',30,true),payment=text('payment_status',30,true),year=text('birth_year',4),revision=Number(data.get('revision')??0);
 if(!['manual','registration','season9'].includes(source)||!['phone','instagram'].includes(contact_type)||!Object.hasOwn(applicationStatuses,status)||!Object.hasOwn(paymentStatuses,payment)||!Number.isSafeInteger(revision)||revision<0||(id&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))||(!id&&(source!=='manual'||!source_note)))throw new Error('invalid');
 if(contact_type==='phone'&&!/^\+?[0-9]{8,15}$/.test(contact.replace(/[ ()-]/g,'')))throw new Error('invalid');
 if(year&&(!/^\d{4}$/.test(year)||Number(year)<1900||Number(year)>new Date().getUTCFullYear()))throw new Error('invalid');
 return {source,id:id||null,name,contact,contact_type,nationality,note,source_note,status,payment,birth_year:year?Number(year):null,revision};
}
export type ApplicantQuery={preferred_class?:string;nationality_group?:string;archived?:string;korean?:string;english?:string;q?:string;status?:string;payment?:string;nationality?:string;year?:string;event?:string;utm_source?:string;utm_medium?:string};
