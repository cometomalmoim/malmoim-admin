'use client';
import { useState } from 'react';
import { accountFaviconUrl } from '@/lib/external-account-favicon';
export function AccountServiceIcon({url,size=24}:{url?:string|null;size?:24|32}) {
  const source=accountFaviconUrl(url);
  return <ServiceImage key={source??'fallback'} source={source} size={size}/>;
}
function ServiceImage({source,size}:{source:string|null;size:number}) {
  const [failed,setFailed]=useState(false);
  return <span className="ea-service-icon" style={{width:size,height:size}} aria-hidden="true">
    {source&&!failed ?
      // Google's favicon endpoint redirects to its image CDN; use a direct browser image with no referrer.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={source} width={size} height={size} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" onError={()=>setFailed(true)}/>
      : '▦'}
  </span>;
}
