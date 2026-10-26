export const SIMPLE_BUCKET='history-simple-photos';
export const SIMPLE_MAX_BYTES=4*1024*1024;
// Production activation remains opt-in and bound to the confirmed team project.
export const SIMPLE_PRODUCTION_PROJECT='https://qkhlvdctdcpfyvohhikl.supabase.co';
export function simplePhotosEnabled(env:Record<string,string|undefined>=process.env){
 return env.NODE_ENV==='production'&&env.VERCEL_ENV==='production'
  &&env.HISTORY_PHOTO_PRODUCTION_ENABLED==='true'
  &&env.HISTORY_PHOTO_PRODUCTION_REVIEWED==='true'
  &&env.NEXT_PUBLIC_SUPABASE_URL===SIMPLE_PRODUCTION_PROJECT
  &&env.SUPABASE_LOCAL_TEST!=='true';
}
export const validId=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
export function albumInput(v:Record<string,unknown>){const title=typeof v.title==='string'?v.title.trim():'',date=typeof v.date==='string'?v.date:'',description=typeof v.description==='string'?v.description:'';if(!title||title.length>200||description.length>2000||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('INVALID_INPUT');return {title,date,description};}

