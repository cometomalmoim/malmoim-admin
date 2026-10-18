export const confirmations={unconfirmed:'미확정',confirmed:'참가 확정',cancelled:'참가 취소'};
export const attendances={unrecorded:'미기록',attended:'참석',absent:'미참석',no_show:'노쇼'};
export const validId=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function participationInput(data:FormData){const confirmation=String(data.get('confirmation')??''),attendance=String(data.get('attendance')??''),note=String(data.get('note')??'').trim(),revision=Number(data.get('revision'));
 if(!Object.hasOwn(confirmations,confirmation)||!Object.hasOwn(attendances,attendance)||note.length>2000||!Number.isSafeInteger(revision)||revision<1)throw new Error('invalid');
 if(attendance!=='unrecorded'&&confirmation!=='confirmed')throw new Error('confirmation');return {confirmation,attendance,note,revision};}
