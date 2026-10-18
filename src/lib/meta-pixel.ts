export const META_PIXEL_ID='1120189660978956';
export const META_CONSENT_KEY='malmoim-meta-consent-v1';
const landingPaths=new Set(['/season9','/season9/en','/2026halloweenparty','/2026halloweenparty/en']);
export function isMetaLanding(path:string,hostname:string){return ['malmoim.com','www.malmoim.com'].includes(hostname)&&landingPaths.has(path);}
export type MetaQueue=((...args:unknown[])=>void)&{queue?:unknown[][];callMethod?:(...args:unknown[])=>void;push?:MetaQueue;loaded?:boolean;version?:string};
export type MetaWindow={fbq?:MetaQueue;_fbq?:MetaQueue;malmoimMetaInitialized?:boolean;malmoimMetaLastPath?:string};
export function initializeMeta(w:MetaWindow){
 if(w.malmoimMetaInitialized)return;
 if(!w.fbq){const queue:MetaQueue=(...args)=>{if(queue.callMethod)queue.callMethod(...args);else queue.queue?.push(args);};queue.queue=[];queue.push=queue;queue.loaded=true;queue.version='2.0';w.fbq=queue;w._fbq=queue;}
 w.fbq('consent','grant');
 // Never automatically read forms or send advanced-matching identifiers.
 w.fbq('set','autoConfig',false,META_PIXEL_ID);
 w.fbq('init',META_PIXEL_ID);
 w.malmoimMetaInitialized=true;
}
export function metaPageView(w:MetaWindow,path:string,hostname:string,allowed:boolean){
 if(!allowed||!isMetaLanding(path,hostname)){w.fbq?.('consent','revoke');w.malmoimMetaLastPath=undefined;return;}
 if(!w.fbq||!w.malmoimMetaInitialized)return;
 w.fbq('consent','grant');
 if(w.malmoimMetaLastPath===path)return;
 w.fbq('trackSingle',META_PIXEL_ID,'PageView');
 w.malmoimMetaLastPath=path;
}
