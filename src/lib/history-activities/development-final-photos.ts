import type {HistoryPhoto} from '@/app/(public)/history/history-data';
/** Browser-only local preview bridge. Preserve the existing gallery/slide component.
 * Signed final-read URLs never enter Next Image's optimizer. No temporary fallback. */
export async function localFinalPhotos(photos:HistoryPhoto[],remember:(url:string)=>void):Promise<HistoryPhoto[]>{
 const mapped=new Map<string,Promise<string>>();
 function image(src:string){
  if(mapped.has(src))return mapped.get(src)!;
  const task=(async()=>{const u=new URL(src);if(u.origin!=='http://127.0.0.1:58421'||!u.pathname.startsWith('/storage/v1/object/sign/history-activity-final-photos/'))throw Error('Unexpected final read target');
   const response=await fetch(u,{redirect:'error',cache:'no-store',credentials:'omit'});if(!response.ok)throw Error('Final image unavailable');
   const blob=await response.blob();if(blob.size<1||blob.size>4718592||!['image/png','image/jpeg','image/webp'].includes(blob.type))throw Error('Unexpected final image');
   const url=URL.createObjectURL(blob);remember(url);return url;})();mapped.set(src,task);return task;
 }
 return Promise.all(photos.map(async p=>({...p,src:await image(p.src),slidePhotos:await Promise.all((p.slidePhotos??[{src:p.src,alt:p.alt}]).map(async slide=>({...slide,src:await image(slide.src)})))})));
}
