export type PublicEventReview = { id: string; display_name: string; locale: 'ko'|'en'; body: string };
export function reviewInput(data: FormData) {
 const id=String(data.get('id')??''),event=String(data.get('event')??''),revision=Number(data.get('revision')),name=String(data.get('name')??'').trim(),locale=String(data.get('locale')??''),body=String(data.get('body')??'').trim(),note=String(data.get('note')??'').trim(),order=Number(data.get('order')),published=data.get('published')==='on',confirmed=data.get('confirmed')==='on';
 const uuid=(value:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
 if(!uuid(id)||!uuid(event)||!Number.isSafeInteger(revision)||revision<0||!name||name.length>60||!['ko','en'].includes(locale)||!body||body.length>1000||note.length>500||!Number.isSafeInteger(order)||order<0||order>9999||(published&&!confirmed))return null;
 return {id,event,revision,name,locale,body,note,order,published,confirmed};
}
