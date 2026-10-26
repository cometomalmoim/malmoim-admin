// Only called by a user action. No decode, clock or DOM work during rendering.
export const SOURCE_MAX_BYTES=20*1024*1024;
export const SOURCE_MAX_PIXELS=60000000;
const EDGE=2000,OUTPUT_MAX_BYTES=4*1024*1024;
export function inspectSource(bytes:Uint8Array){
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let width=0,height=0;
 if(bytes[0]===255&&bytes[1]===216){
  for(let p=2;p+4<=bytes.length;){if(bytes[p++]!==255)throw Error('PHOTO_BROWSER_INVALID');while(bytes[p]===255)p++;const marker=bytes[p++];if(marker===217||marker===218)break;if(marker===1||marker>=208&&marker<=215)continue;const length=v.getUint16(p);if(length<2||p+length>bytes.length)throw Error('PHOTO_BROWSER_INVALID');if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){if(length<7)throw Error('PHOTO_BROWSER_INVALID');height=v.getUint16(p+3);width=v.getUint16(p+5);break;}p+=length;}
 }else if(bytes.length>=24&&v.getUint32(0)===0x89504e47&&v.getUint32(4)===0x0d0a1a0a){
  width=v.getUint32(16);height=v.getUint32(20);
  for(let p=8;p+12<=bytes.length;){const n=v.getUint32(p),tag=v.getUint32(p+4);if(p+n+12>bytes.length)throw Error('PHOTO_BROWSER_INVALID');if(tag===0x6163544c)throw Error('PHOTO_ANIMATION_UNSUPPORTED');if(tag===0x49444154)break;p+=n+12;}
 }else if(bytes.length>=30&&v.getUint32(0)===0x52494646&&v.getUint32(8)===0x57454250){
  const tag=v.getUint32(12);
  if(tag===0x56503858){if(bytes[20]&2)throw Error('PHOTO_ANIMATION_UNSUPPORTED');width=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16);height=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16);}
  else if(tag===0x56503820&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42){width=v.getUint16(26,true)&16383;height=v.getUint16(28,true)&16383;}
  else if(tag===0x5650384c&&bytes[20]===47){const bits=v.getUint32(21,true);width=(bits&16383)+1;height=((bits>>>14)&16383)+1;}
 }
 if(!width||!height)throw Error('PHOTO_BROWSER_INVALID');
 if(width>16384||height>16384||width*height>SOURCE_MAX_PIXELS)throw Error('PHOTO_SOURCE_PIXEL_LIMIT');
 return {width,height};
}
function timed<T>(promise:Promise<T>,lateCleanup?:((value:T)=>void),errorCode='PHOTO_BROWSER_INVALID'):Promise<T>{return new Promise((resolve,reject)=>{let expired=false;const timer=setTimeout(()=>{expired=true;reject(Error('PHOTO_OPTIMIZE_TIMEOUT'));},25000);promise.then(value=>{clearTimeout(timer);if(expired)lateCleanup?.(value);else resolve(value);},()=>{clearTimeout(timer);if(!expired)reject(Error(errorCode));});});}
async function decoded(file:File):Promise<{image:CanvasImageSource;width:number;height:number;close:()=>void}>{
 if(typeof createImageBitmap==='function'){const bitmap=await timed(createImageBitmap(file,{imageOrientation:'from-image'}),b=>b.close());return {image:bitmap,width:bitmap.width,height:bitmap.height,close:()=>bitmap.close()};}
 const url=URL.createObjectURL(file),image=new Image();
 try{image.src=url;await timed(image.decode());return {image,width:image.naturalWidth,height:image.naturalHeight,close:()=>{image.src='';URL.revokeObjectURL(url);}};}
 catch(error){image.src='';URL.revokeObjectURL(url);throw error;}
}
export function validateSourceFiles(files:File[]){
 if(!files.length||files.length>10)throw Error('PHOTO_FILES_INVALID');
 const keys=files.map(f=>JSON.stringify([f.name,f.size,f.lastModified,f.type]));if(new Set(keys).size!==keys.length)throw Error('PHOTO_FILES_DUPLICATE');
 for(const file of files){if(!file.size)throw Error('PHOTO_BROWSER_INVALID');if(file.size>SOURCE_MAX_BYTES)throw Error('PHOTO_SOURCE_TOO_LARGE');if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('PHOTO_FORMAT_UNSUPPORTED');}
}
export async function optimizePhoto(file:File,index=0):Promise<File>{
 validateSourceFiles([file]);try{inspectSource(new Uint8Array(await file.arrayBuffer()));}catch(error){if(error instanceof Error&&error.message.startsWith('PHOTO_'))throw error;throw Error('PHOTO_BROWSER_INVALID');}
 const source=await decoded(file);let canvas:HTMLCanvasElement|undefined;
 try{
  if(!source.width||!source.height||source.width*source.height>SOURCE_MAX_PIXELS)throw Error('PHOTO_SOURCE_PIXEL_LIMIT');
  const scale=Math.min(1,EDGE/Math.max(source.width,source.height));canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(source.width*scale));canvas.height=Math.max(1,Math.round(source.height*scale));
  const context=canvas.getContext('2d');if(!context)throw Error('PHOTO_OPTIMIZE_FAILED');context.drawImage(source.image,0,0,canvas.width,canvas.height);
  for(const quality of [.86,.78,.68]){
   let blob=await timed(new Promise<Blob>((resolve,reject)=>canvas!.toBlob(b=>b?resolve(b):reject(Error()),'image/webp',quality)),undefined,'PHOTO_OPTIMIZE_FAILED');
   if(blob.type!=='image/webp'){context.globalCompositeOperation='destination-over';context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);blob=await timed(new Promise<Blob>((resolve,reject)=>canvas!.toBlob(b=>b?resolve(b):reject(Error()),'image/jpeg',quality)),undefined,'PHOTO_OPTIMIZE_FAILED');}
   if(blob.size&&blob.size<=OUTPUT_MAX_BYTES&&['image/webp','image/jpeg'].includes(blob.type))return new File([blob],`photo-${index+1}.${blob.type==='image/webp'?'webp':'jpg'}`,{type:blob.type,lastModified:0});
  }
  throw Error('PHOTO_OUTPUT_TOO_LARGE');
 }catch(error){if(error instanceof Error&&error.message.startsWith('PHOTO_'))throw error;throw Error('PHOTO_OPTIMIZE_FAILED');}finally{source.close();if(canvas){canvas.width=0;canvas.height=0;}}
}
