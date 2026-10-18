import 'server-only';
import {createHmac,createHash,randomBytes} from 'node:crypto';
import {domesticPhone,validSmsText,smsUuid} from './sms-contract';
export function smsConfig(){
 const key=process.env.SOLAPI_API_KEY?.trim(),secret=process.env.SOLAPI_API_SECRET?.trim();
 const sender=domesticPhone(process.env.SOLAPI_SENDER_NUMBER??''),notify=domesticPhone(process.env.SOLAPI_ADMIN_NOTIFY_NUMBER??'');
 if(!key||!secret||!sender||!notify)return null;
 const worker=createHmac('sha256',secret).update(['malmoim-sms-worker-v1',key,sender,notify].join(':')).digest('hex');
 return {key,secret,sender,notify,worker,workerHash:createHash('sha256').update(worker).digest('hex')};
}
export const maskPhone=(n:string)=>n.slice(0,3)+'****'+n.slice(-4);
async function request(path:string,body?:unknown){
 const config=smsConfig();if(!config)throw new Error('sms_unconfigured');
 const date=new Date().toISOString(),salt=randomBytes(24).toString('hex');
 const signature=createHmac('sha256',config.secret).update(date+salt).digest('hex');
 const response=await fetch('https://api.solapi.com'+path,{method:body?'POST':'GET',headers:{Authorization:`HMAC-SHA256 apiKey=${config.key}, date=${date}, salt=${salt}, signature=${signature}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000),cache:'no-store'});
 if(!response.ok)throw new Error(response.status>=400&&response.status<500&&response.status!==408?'sms_rejected':'sms_unknown');
 return response.json();
}
export async function smsPrice(){const data=await request('/pricing/v1/messaging?countryId=82');if(!Number.isFinite(data.lms)||data.lms<=0||!Number.isFinite(data.sms)||data.sms<=0)throw new Error('sms_price');return {LMS:Number(data.lms),SMS:Number(data.sms)};}
export async function sendSms(to:string,text:string,type:'LMS'|'SMS',reference?:string){
 const config=smsConfig();if(!config)throw new Error('sms_unconfigured');
 if(domesticPhone(to)!==to||!validSmsText(text)||(type==='SMS'&&new TextEncoder().encode(text).length>90)||(reference&&!smsUuid(reference)))throw new Error('sms_rejected');
 const data=await request('/messages/v4/send-many/detail',{messages:[{to,from:config.sender,text,type,country:'82',...(reference?{customFields:{malmoimJobId:reference}}:{}),...(type==='LMS'?{subject:'말모임 안내'}:{})}],allowDuplicates:false});
 const failed=Array.isArray(data.failedMessageList)?data.failedMessageList:[];
 const group=data.groupInfo?.groupId;
 if(failed.length)throw new Error('sms_rejected');
 if(data.groupInfo?.count?.registeredSuccess!==1)throw new Error('sms_unknown');
 if(typeof group!=='string'||!/^G[A-Za-z0-9]{10,80}$/.test(group))throw new Error('sms_unknown');
 return group;
}
export async function smsDelivery(group:string):Promise<'accepted'|'delivered'|'failed'>{
 if(!/^G[A-Za-z0-9]{10,80}$/.test(group))throw new Error('sms_group');
 const data=await request('/messages/v4/groups/'+encodeURIComponent(group));
 if(data.count?.sentSuccess===1)return 'delivered';
 if(data.count?.sentFailed===1||data.count?.registeredFailed===1)return 'failed';
 return 'accepted';
}
