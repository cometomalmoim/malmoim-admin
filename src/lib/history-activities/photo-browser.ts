import {activityPhotoPolicy} from './photo-policy';
import type {ActivityResult,ReservePhotoRequest,PublicActivity} from './vercel-photo-client';
export class PhotoRequestError extends Error {constructor(public status:string){super(status==='conflict'?'다른 변경과 충돌했습니다. 새로고침 후 확인해주세요.':'처리 결과 확인 필요 · 자동 재전송하지 않습니다.');}}
export function photoBrowser(fetcher:typeof fetch=fetch){
 async function command(operation:string,payload:unknown,binding?:unknown){const r=await fetcher('/api/admin/history-photos',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({operation,payload,...(binding?{binding}:{})})});const data=await r.json();if(!r.ok||data.status!=='recorded')throw new PhotoRequestError(data.status??'uncertain');return data.value;}
 async function refresh():Promise<{enabled:boolean;activities:ActivityResult[];storageOrigin?:string}>{try{const r=await fetcher('/api/admin/history-photos',{credentials:'same-origin',cache:'no-store'});const d=await r.json();return r.ok&&d.enabled===true?d:{enabled:false,activities:[]};}catch{return {enabled:false,activities:[]};}}
 async function register(info:{title:string;date:string;description:string},files:File[],storageOrigin:string){
  if(!files.length||files.length>10||files.some(f=>!f.size||f.size>activityPhotoPolicy.maxBytes||!(activityPhotoPolicy.mimeTypes as readonly string[]).includes(f.type))||files.reduce((n,f)=>n+f.size,0)>activityPhotoPolicy.totalBytes)throw new PhotoRequestError('invalid');
  const origin=new URL(storageOrigin);if(origin.protocol!=='https:'||origin.origin!==storageOrigin)throw new PhotoRequestError('invalid');
  let activity:ActivityResult=await command('create',{requestId:crypto.randomUUID(),...info});const order:string[]=[];
  for(const file of files){
   const requestId=crypto.randomUUID(),mime=file.type as ReservePhotoRequest['mime'];const reserved:ActivityResult=await command('reserve',{requestId,activityId:activity.activityId,revision:activity.revision,size:file.size,mime});
   if(!reserved.jobId||!reserved.photoId)throw new PhotoRequestError('uncertain');
   const grant=await command('permit',{jobId:reserved.jobId,requestId,permitRequestId:crypto.randomUUID()},{activityId:activity.activityId,photoId:reserved.photoId,mime});
   const url=new URL(grant.signedUrl),extension=mime==='image/jpeg'?'jpg':mime==='image/png'?'png':'webp';
   if(url.origin!==storageOrigin||url.username||url.password||url.hash||url.pathname!==`/storage/v1/object/upload/sign/history-activity-photos/${activity.activityId}/${reserved.photoId}.${extension}`)throw new PhotoRequestError('invalid');
   const upload=await fetcher(url,{method:'PUT',credentials:'omit',redirect:'error',headers:{'content-type':mime,'x-upsert':'false'},body:file,signal:AbortSignal.timeout(60000)});if(!upload.ok)throw new PhotoRequestError('uncertain');
   await command('finalize',{jobId:reserved.jobId,requestId});order.push(reserved.photoId);
   activity=await command('inspect',{activityId:activity.activityId});
  }
  return command('layout',{activityId:activity.activityId,revision:activity.revision,requestId:crypto.randomUUID(),order,cover:order[0]});
 }
 return {command,refresh,register};
}
export function publicHistoryPhoto(a:PublicActivity){const cover=a.photos.find(p=>p.id===a.coverId);if(!cover)throw new Error('Missing cover');return {id:a.id,unoptimized:true,category:'special' as const,title:a.title,date:a.date,description:a.description,src:cover.src,alt:a.title,slidePhotos:a.photos.map((p,i)=>({src:p.src,alt:`${a.title} ${i+1}번 사진`}))};}
