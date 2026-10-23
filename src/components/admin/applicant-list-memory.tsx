"use client";
import {useEffect} from 'react';
import Link from 'next/link';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {safeApplicantListHref} from '@/lib/applicant-list-memory';
const key=(email:string,kind:string)=>`malmoim:applicant-list:${email}:${kind}`;
export function rememberedApplicantList(email:string,kind:'all'|'last') {
 try { return safeApplicantListHref(sessionStorage.getItem(key(email,kind)),kind==='all'); } catch { return null; }
}
export function ApplicantListMemory({email}:{email?:string}) {
 const pathname=usePathname(),search=useSearchParams().toString();
 useEffect(()=>{
  if(!email)return;
  const href=safeApplicantListHref(pathname+(search?'?'+search:''));
  if(!href)return;
  try {
   sessionStorage.setItem(key(email,'last'),href);
   if(pathname==='/admin/recruitment')sessionStorage.setItem(key(email,'all'),href);
  } catch { /* Restricted storage falls back to normal links. */ }
 },[email,pathname,search]);
 return null;
}
export function ApplicantListReturn({email,fallback}:{email:string;fallback:string}) {
 const router=useRouter();
 return <Link href={fallback} onNavigate={event=>{const saved=rememberedApplicantList(email,'last');if(saved&&saved!==fallback){event.preventDefault();router.push(saved);}}}>← 조회하던 신청자 목록</Link>;
}
