export const PHOTO_CATEGORIES = [
 {id:'regular',label:'정규 활동'}, {id:'special',label:'특별 활동'},
 {id:'event',label:'행사·파티'}, {id:'study',label:'스터디'}, {id:'other',label:'기타'},
] as const;
export type PhotoCategory = typeof PHOTO_CATEGORIES[number]['id'];
export const HISTORY_COHORTS = [9,8,7,6,5,4,3,2,1];
export function photoClassification(input:{category?:unknown;cohort?:unknown}){
 const category=input.category===undefined?'special':input.category;
 if(!PHOTO_CATEGORIES.some(c=>c.id===category))throw Error('INVALID_INPUT');
 const cohort=input.cohort??null;
 if(category==='regular' ? !Number.isInteger(cohort)||Number(cohort)<1||Number(cohort)>32767 : cohort!==null)throw Error('INVALID_INPUT');
 return {category:category as PhotoCategory,cohort:cohort as number|null};
}
