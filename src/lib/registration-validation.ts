export function registrationInput(data: FormData, halloween=false) {
 const name=String(data.get('name')??'').trim();
 const nationality=String(data.get('nationality')??'').trim();
 if(nationality.length>100)throw new Error('nationality');
 const raw=String(data.get('contact')??'').trim();
 let contact=raw.replace(/[ ()-]/g,'');
 if(/^010[0-9]{8}$/.test(contact))contact='+82'+contact.slice(1);
 if(/^0082/.test(contact))contact='+'+contact.slice(2);
 const history=String(data.get('history')??'');
 const detail=history==='new'?'':String(data.get('history_detail')??'').trim();
 const submission=String(data.get('submission_id')??'');
 const year=String(data.get('birth_year')??'').trim();
 const currentYear=new Date(Date.now()+9*3600000).getUTCFullYear();
 if(year&&(!/^\d{4}$/.test(year)||Number(year)<1900||Number(year)>currentYear))throw new Error('birth_year');
 if(halloween&&(!year||Number(year)<1990||Number(year)>2007))throw new Error('birth_year');
 if(!name||name.length>100||raw.length>40||!/^\+?[0-9]{8,15}$/.test(contact)||!['new','returning'].includes(history)||detail.length>300||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submission)) throw new Error('invalid');
 if(data.get('privacy_consent')!=='on') throw new Error('consent');
 return {name,nationality:nationality||null,contact,history,detail,submission,version:String(data.get('version')??''),birth_year:year?Number(year):null};
}
