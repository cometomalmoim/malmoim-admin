import {SIMPLE_MAX_BYTES} from './policy.ts';
const MAX_PIXELS=24000000;
/** No paths, input bytes, EXIF or raw native error text enter diagnostics. */
function failure(code:string,stage:string):never{console.info('HISTORY_PHOTO_NORMALIZE',JSON.stringify({stage,code}));throw Error(code);}
export async function normalizePhoto(bytes:Uint8Array){
 if(!bytes.length)throw Error('INVALID_IMAGE');
 if(bytes.length>SIMPLE_MAX_BYTES)throw Error('PHOTO_INPUT_TOO_LARGE');
 let sharp:typeof import('sharp')['default'];
 try{sharp=(await import('sharp')).default;if(typeof sharp!=='function')throw Error();}
 catch{return failure('PHOTO_DECODER_UNAVAILABLE','load');}
 let image:ReturnType<typeof sharp>,meta:Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
 try{image=sharp(Buffer.from(bytes),{limitInputPixels:MAX_PIXELS,animated:false,failOn:'warning'});meta=await image.metadata();}
 catch(error){return failure(error instanceof Error&&/pixel limit/i.test(error.message)?'PHOTO_PIXEL_LIMIT':'INVALID_IMAGE','metadata');}
 if(!['jpeg','png','webp'].includes(meta.format??''))throw Error('PHOTO_FORMAT_UNSUPPORTED');
 if((meta.pages??1)!==1)throw Error('PHOTO_ANIMATION_UNSUPPORTED');
 if(!meta.width||!meta.height)throw Error('INVALID_IMAGE');
 if(meta.width*meta.height>MAX_PIXELS)throw Error('PHOTO_PIXEL_LIMIT');
 let result:Buffer;
 try{result=await image.rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();}
 catch{return failure('PHOTO_CONVERSION_FAILED','encode');}
 if(!result.length)throw Error('PHOTO_CONVERSION_FAILED');
 if(result.length>SIMPLE_MAX_BYTES)throw Error('PHOTO_OUTPUT_TOO_LARGE');
 return result;
}
