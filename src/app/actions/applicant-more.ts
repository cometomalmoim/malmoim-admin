'use server';
import {getRecruitment} from '@/lib/recruitment';
import type {ApplicantQuery} from '@/lib/applicant-validation';
export async function loadMoreApplicants(page:number,query:ApplicantQuery){
 if(!Number.isSafeInteger(page)||page<1||page>100000)throw new Error('조회 범위를 확인해주세요.');
 const result=await getRecruitment(undefined,page,query,true);
 if(result.kind!=='ready')throw new Error('신청자를 불러오지 못했습니다.');
 return {rows:result.rows,count:result.count};
}
