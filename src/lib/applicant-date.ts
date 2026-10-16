export function applicantDate(value:string){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('invalid');
 const date=new Date(`${value}+09:00`);
 if(!Number.isFinite(date.getTime())||date.getUTCFullYear()<1900||date.getTime()>Date.now()+60000||new Date(date.getTime()+32400000).toISOString().slice(0,16)!==value)throw new Error('invalid');
 return date.toISOString();
}
