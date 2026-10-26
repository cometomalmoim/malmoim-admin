import {albumInput,SIMPLE_MAX_BYTES} from './policy.ts';
export function validateRegistrationFiles(files:File[]){
 if(!files.length||files.length>10||files.some(f=>!f.size||f.size>SIMPLE_MAX_BYTES||!['image/png','image/jpeg','image/webp'].includes(f.type)))throw Error('PHOTO_FILES_INVALID');
 const keys=files.map(f=>JSON.stringify([f.name,f.size,f.lastModified,f.type]));
 if(new Set(keys).size!==keys.length)throw Error('PHOTO_FILES_DUPLICATE');
}
/** Publish is unreachable until every upload acknowledges success. Never retry writes. */
export async function registerPhotos(info:Record<string,unknown>,files:File[],ports:{create(info:ReturnType<typeof albumInput>):Promise<{id:string}>;upload(id:string,files:File[]):Promise<void>;publish(id:string):Promise<unknown>}){
 const input=albumInput(info);validateRegistrationFiles(files);
 const album=await ports.create(input);
 try{await ports.upload(album.id,files);}catch{throw Error('PHOTO_UPLOAD_INCOMPLETE');}
 await ports.publish(album.id);
 return album;
}
