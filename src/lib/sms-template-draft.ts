export function starterTemplateOriginal(template:{body:string;language:string}){
 return template.body|| (template.language==='en'?'Hello, this is the MALMOIM team.\n\nHi {이름}, here is an update.':'안녕하세요, 말모임 운영진입니다.\n\n{이름}님께 안내드립니다.');
}
export function templateDraftDirty(original:string,current:string){return original!==current;}
