import {META_CONSENT_KEY} from './meta-pixel';
let memoryConsent:string|null=null;
export function readMetaConsent(){try{const value=localStorage.getItem(META_CONSENT_KEY);return value==='granted'||value==='denied'?value:memoryConsent;}catch{return memoryConsent;}}
export function saveMetaConsent(value:'granted'|'denied'){try{localStorage.setItem(META_CONSENT_KEY,value);}catch{/* Current document only. */}memoryConsent=value;window.dispatchEvent(new Event('malmoim-meta-consent'));}
export function subscribeMetaConsent(listener:()=>void){window.addEventListener('storage',listener);window.addEventListener('malmoim-meta-consent',listener);return()=>{window.removeEventListener('storage',listener);window.removeEventListener('malmoim-meta-consent',listener);};}
