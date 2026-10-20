export function wideApplicantResponse(label:string,value:string){
 return /참여 동기|기대 활동|추가 소개|참여 이력 응답/.test(label)||value.length>80||value.includes('\n');
}
