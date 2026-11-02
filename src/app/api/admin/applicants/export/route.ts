import {getAdminAccess} from '@/lib/auth';
import {getRecruitment,type ApplicationRow} from '@/lib/recruitment';
import type {ApplicantQuery} from '@/lib/applicant-validation';
import {applicantWorkbook} from '@/lib/applicant-export';

const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const fail=(error:string,status:number)=>Response.json({error},{status,headers});
export async function GET(request:Request){
 if((await getAdminAccess()).status!=='admin')return fail('관리자 로그인이 필요합니다.',403);
 const params=new URL(request.url).searchParams;
 const query:ApplicantQuery={};
 for(const key of ['event','q','status','payment','preferred_class','nationality_group','archived','korean','english','nationality','year','utm_source','utm_medium'] as const){
  const value=params.get(key);if(value)query[key]=value.slice(0,150);
 }
 try{
  const rows:ApplicationRow[]=[];let count=0;
  for(let page=1;page===1||rows.length<count;page++){
   const result=await getRecruitment(undefined,page,query,true,{pageSize:500,includeSms:false});
   if(result.kind!=='ready')return fail('명단을 불러오지 못했습니다. 다시 시도해주세요.',503);
   if(page===1){count=result.count;if(count>5000)return fail('한 번에 5,000명까지 다운로드할 수 있습니다. 이벤트 등 조회 조건을 좁혀주세요.',413);if(count===0)return fail('다운로드할 신청자가 없습니다.',400);}
   if(result.count!==count||!result.rows.length)return fail('조회 중 명단이 변경되었습니다. 다시 다운로드해주세요.',409);
   rows.push(...result.rows);
  }
  const unique=new Set(rows.map(row=>`${row.event_id}:${row.source}:${row.id}`));
  if(rows.length!==count||unique.size!==count)return fail('조회 중 명단이 변경되었습니다. 다시 다운로드해주세요.',409);
  const stamp=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
  return new Response(Buffer.from(applicantWorkbook(rows)),{headers:{...headers,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="malmoim-applicants-${stamp}.xlsx"`}});
 }catch{return fail('엑셀 파일을 만들지 못했습니다. 잠시 후 다시 시도해주세요.',500);}
}
