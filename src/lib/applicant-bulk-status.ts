import type {ApplicationRow} from './recruitment';
import {applicationStatuses,paymentStatuses} from './applicant-validation';
import {applicantEditData} from './applicant-inline';
export async function applyApplicantStatuses(rows:ApplicationRow[],field:'status'|'payment_status',value:string,save:(slug:string,previous:{code:string},data:FormData)=>Promise<{code:string}>){
 const options=field==='status'?applicationStatuses:field==='payment_status'?paymentStatuses:{};
 if(!rows.length||rows.length>50||!Object.hasOwn(options,value))throw new Error('상태와 선택 인원을 확인해주세요. 최대 50명까지 변경합니다.');
 const results:{row:ApplicationRow;code:string}[]=[];
 for(const row of rows){
  if(row[field]===value){results.push({row,code:'unchanged'});continue;}
  if(!row.event_slug||row.is_archived){results.push({row,code:'invalid'});continue;}
  try{results.push({row,code:(await save(row.event_slug,{code:''},applicantEditData(row,field,value))).code});}
  catch{results.push({row,code:'error'});}
 }
 return results;
}
