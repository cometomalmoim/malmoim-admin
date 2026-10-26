import {albumInput,SIMPLE_MAX_BYTES,validId} from './policy';
export type SimpleOperations={list():Promise<unknown>;create(info:ReturnType<typeof albumInput>):Promise<unknown>;edit(id:string,info:ReturnType<typeof albumInput>):Promise<void>;upload(id:string,bytes:Uint8Array):Promise<unknown>;publish(id:string,published:boolean):Promise<void>;deleteAlbum(id:string):Promise<void>;deletePhoto(id:string):Promise<void>};
const reply=(status:number,data:unknown)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function bounded(request:Request,max:number){const reader=request.body?.getReader();if(!reader)throw Error('INVALID_INPUT');const chunks:Uint8Array[]=[];let size=0;try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>max)throw Error('TOO_LARGE');chunks.push(p.value);}return Buffer.concat(chunks);}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}}
export function createSimpleAdminApi(ports:{enabled():boolean;access():Promise<{status:string}>;ops:SimpleOperations}){return async(request:Request)=>{
 try{const access=await ports.access();if(access.status!=='admin')return reply(access.status==='anonymous'?401:403,{code:'ADMIN_REQUIRED'});if(!ports.enabled())return reply(503,{enabled:false,code:'PERSONAL_TEST_DISABLED'});
  if(request.method==='GET')return reply(200,{enabled:true,albums:await ports.ops.list()});
  if(request.method!=='POST')return reply(405,{code:'METHOD_NOT_ALLOWED'});
  const origin=request.headers.get('origin'),urlOrigin=new URL(request.url).origin;
  if(origin!==urlOrigin||request.headers.get('sec-fetch-site')==='cross-site')return reply(403,{code:'ORIGIN_DENIED'});
  const type=request.headers.get('content-type')??'';
  if(type.startsWith('multipart/form-data')){
   const bytes=await bounded(request,SIMPLE_MAX_BYTES+65536),form=await new Request(request.url,{method:'POST',headers:{'content-type':type},body:bytes}).formData();
   const id=form.get('albumId'),file=form.get('file');if([...form.keys()].some(k=>!['albumId','file'].includes(k))||form.getAll('file').length!==1||form.getAll('albumId').length!==1||!validId(id)||!(file instanceof File)||!file.size||file.size>SIMPLE_MAX_BYTES||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('INVALID_INPUT');
   if((await ports.access()).status!=='admin')return reply(403,{code:'ADMIN_REQUIRED'});
   return reply(200,{value:await ports.ops.upload(id,new Uint8Array(await file.arrayBuffer()))});
  }
  if(!type.startsWith('application/json'))throw Error('INVALID_INPUT');const input=JSON.parse((await bounded(request,8192)).toString());if(!input||typeof input!=='object'||Array.isArray(input))throw Error('INVALID_INPUT');
  const {op,id,...body}=input;if(typeof op!=='string')throw Error('INVALID_INPUT');
  if(op==='create'){if(id!==undefined||Object.keys(body).sort().join()!=='date,description,title')throw Error('INVALID_INPUT');return reply(200,{value:await ports.ops.create(albumInput(body))});}
  if(!validId(id))throw Error('INVALID_INPUT');
  if(op==='edit'){if(Object.keys(body).sort().join()!=='date,description,title')throw Error('INVALID_INPUT');await ports.ops.edit(id,albumInput(body));}
  else if(op==='publish'){if(Object.keys(body).join()!=='published'||typeof body.published!=='boolean')throw Error('INVALID_INPUT');await ports.ops.publish(id,body.published);}
  else if(op==='delete_album'||op==='delete_photo'){if(Object.keys(body).length)throw Error('INVALID_INPUT');await (op==='delete_album'?ports.ops.deleteAlbum:ports.ops.deletePhoto)(id);}
  else throw Error('INVALID_INPUT');return reply(200,{ok:true});
 }catch(error){const known=error instanceof Error?error.message:'';return reply(known==='TOO_LARGE'?413:['INVALID_INPUT','INVALID_IMAGE'].includes(known)?400:503,{code:known==='TOO_LARGE'?'BODY_TOO_LARGE':['INVALID_INPUT','INVALID_IMAGE'].includes(known)?'INVALID_INPUT':'PHOTO_RESULT_UNCONFIRMED'});}
};}
