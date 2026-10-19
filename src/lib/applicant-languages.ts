export const applicantLanguageLevels={none:'처음 배우는 단계',basic:'간단한 인사·짧은 문장',intermediate:'일상 회화 가능',fluent:'유창함',native:'모국어',unknown:'미입력'};
export function languageStoredValue(language:'korean'|'english',level:string){
 return ({none:'전혀 못함 / None',basic:'조금 가능 / Basic',intermediate:'일상 회화 가능 / Intermediate',fluent:'유창함 / Fluent',native:language==='korean'?'저는 한국 사람입니다 / I am Korean':'모국어 / Native'} as Record<string,string>)[level];
}

export function languageLevelLabel(language:'korean'|'english',value:string|null|undefined){
 if(!value?.trim())return '미입력';
 for(const level of Object.keys(applicantLanguageLevels))if(languageStoredValue(language,level)===value)return ({none:'입문',basic:'기초',intermediate:'일상 회화',fluent:'유창',native:'모국어'} as Record<string,string>)[level];
 return value;
}
