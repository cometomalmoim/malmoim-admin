/** Shared values for the active Season 9 intake; never sent to analytics. */
export const season9OptionalGenders = [
 {value:'male',ko:'남성',en:'Male'},
 {value:'female',ko:'여성',en:'Female'},
 {value:'self_describe',ko:'직접 입력',en:'Self-describe'},
 {value:'prefer_not_to_say',ko:'응답하지 않음',en:'Prefer not to say'},
] as const;
export function season9GenderInput(form:FormData):{gender:string|null}|null {
 const choice=String(form.get('gender')??'').trim();
 if(!choice)return {gender:null};
 if(!season9OptionalGenders.some(item=>item.value===choice))return null;
 if(choice!=='self_describe')return {gender:choice};
 const description=String(form.get('gender_description')??'').trim();
 // Empty self-description remains optional. Bound stored text to the existing 50-character contract.
 if(description.length>35||/[\u0000-\u001f\u007f]/u.test(description))return null;
 return {gender:description?`self_describe:${description}`:null};
}
export function applicantGenderLabel(value:string|null|undefined):string {
 if(!value?.trim())return '미입력';
 const labels:Record<string,string>={male:'남성',female:'여성',other:'기타',prefer_not_to_say:'응답하지 않음','남성 / Male':'남성','여성 / Female':'여성','답변하지 않음 / Prefer not to say':'응답하지 않음'};
 return value.startsWith('self_describe:')?`직접 입력: ${value.slice(14)}`:labels[value]??value;
}
