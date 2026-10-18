export function registrationInput(data: FormData) {
 const name=String(data.get('name')??'').trim();
 const raw=String(data.get('contact')??'').trim();
 let contact=raw.replace(/[ ()-]/g,'');
 if(/^010[0-9]{8}$/.test(contact))contact='+82'+contact.slice(1);
 if(/^0082/.test(contact))contact='+'+contact.slice(2);
 const history=String(data.get('history')??'');
 const detail=history==='new'?'':String(data.get('history_detail')??'').trim();
 const submission=String(data.get('submission_id')??'');
 if(!name||name.length>100||raw.length>40||!/^\+?[0-9]{8,15}$/.test(contact)||!['new','returning'].includes(history)||detail.length>300||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submission)) throw new Error('invalid');
 if(data.get('privacy_consent')!=='on') throw new Error('consent');
 return {name,contact,history,detail,submission,version:String(data.get('version')??'')};
}
