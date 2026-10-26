"use client";
import {useEffect,useRef,useState} from 'react';
import {refreshSms} from '@/app/actions/messaging';
// Share read-only provider queries across history and result panels.
const recent=new Map<string,{at:number;request:ReturnType<typeof refreshSms>}>();
export function useSmsDelivery(rows:{id:string;state:string}[],reload:()=>Promise<void>,enabled=true){
 const latest=useRef(reload);
 useEffect(()=>{latest.current=reload;},[reload]);
 const [errors,setErrors]=useState<string[]>([]);
 const ids=rows.filter(row=>row.state==='accepted').map(row=>row.id).sort().join(',');
 useEffect(()=>{
  if(!enabled||!ids)return;
  let live=true,running=false;
  async function check(){
   if(running||document.visibilityState!=='visible')return;
   running=true;const failed:string[]=[];
   try{
    for(const id of ids.split(',')){
     if(!live)break;
     let entry=recent.get(id);
     if(!entry||Date.now()-entry.at>=30000){entry={at:Date.now(),request:refreshSms(id)};recent.set(id,entry);}
     try{if(!(await entry.request).ok)failed.push(id);}catch{failed.push(id);}
    }
    if(live){setErrors(failed);await latest.current();}
   }catch{/* Preserve the last known state on read failure. */}finally{running=false;}
   for(const [id,entry] of recent)if(Date.now()-entry.at>60000)recent.delete(id);
  }
  void check();const timer=setInterval(()=>void check(),30000);
  document.addEventListener('visibilitychange',check);
  return()=>{live=false;clearInterval(timer);document.removeEventListener('visibilitychange',check);};
 },[ids,enabled]);
 return errors;
}
