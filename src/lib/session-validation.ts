import {validId,attendances} from './participation-validation.ts';
export function sessionInput(data:FormData){
 const id=String(data.get('session_id')??''),date=String(data.get('session_date')??''),title=String(data.get('title')??'').trim(),revision=Number(data.get('revision'));
 if((id&&!validId(id))||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<'2000-01-01'||date>'2100-12-31'||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||!title||title.length>80||!Number.isSafeInteger(revision)||revision<0||(id?revision<1:revision!==0))throw new Error('invalid');
 return {id:id||null,date,title,revision};
}
export function sessionAttendanceInput(data:FormData){
 const session=String(data.get('session_id')??''),attendance=String(data.get('attendance')??''),revision=Number(data.get('revision')),participationRevision=Number(data.get('participation_revision'));
 if(!validId(session)||!Object.hasOwn(attendances,attendance)||!Number.isSafeInteger(revision)||revision<0||!Number.isSafeInteger(participationRevision)||participationRevision<1)throw new Error('invalid');
 return {session,attendance,revision,participationRevision};
}
