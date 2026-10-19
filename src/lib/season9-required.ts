export const season9GenderChoices = [
 {ko:'남성',en:'Male',value:'남성 / Male'},
 {ko:'여성',en:'Female',value:'여성 / Female'},
 {ko:'답변하지 않음',en:'Prefer not to say',value:'답변하지 않음 / Prefer not to say'},
] as const;
export function season9RequiredFields(data: FormData) {
 const gender=String(data.get('s9-gender')??'').trim();
 const occupation=String(data.get('s9-field-4')??'').trim();
 const motivation=String(data.get('s9-answer-0')??'').trim();
 if(!season9GenderChoices.some(choice=>choice.value===gender)||!occupation||occupation.length>200||!motivation||motivation.length>2000)return null;
 return {gender,occupation,motivation};
}
