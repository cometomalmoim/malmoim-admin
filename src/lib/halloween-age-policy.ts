export function halloweenAgeCopy(english=false){
 return english?{
  title:'Please note: participation eligibility',
  range:'Applicants born from 1990 through 2007 are eligible (inclusive).',
  description:'To help the party run smoothly, participation is limited to this birth-year range. Thank you for your understanding.',
  confirm:'I understand',
 }:{
  title:'주의 · 참가 대상 안내',
  range:'1990년생부터 2007년생까지 신청 가능합니다.',
  description:'원활한 파티 운영을 위해 출생연도 기준으로 참가 대상을 제한하고 있으니 양해 부탁드립니다.',
  confirm:'확인했습니다',
 };
}
