"use client";
import {useState} from "react";
import Link from "next/link";
import {BrandLogo} from "@/components/brand-logo";
import {InstantApplication} from "./instant-application";
import "./application-design.css";
export function ApplicationPage({initialLocale='ko'}:{initialLocale?:'ko'|'en'}){
 const [locale,setLocale]=useState(initialLocale);const en=locale==='en';
 return <div className="s9-site s9-apply-site" lang={locale}><a className="s9-skip" href="#application-main">{en?'Skip to application':'신청서 바로가기'}</a><header className="s9-header"><Link href={en?'/season9/en':'/season9'} className="s9-logo" aria-label={en?'Season 9 details':'9기 모집 안내'}><BrandLogo compact/></Link><nav className="s9-apply-languages" aria-label={en?'Application language':'신청서 언어'}><button type="button" aria-pressed={locale==='ko'} onClick={()=>setLocale('ko')}>한국어</button><button type="button" aria-pressed={en} onClick={()=>setLocale('en')}>English</button></nav></header><main id="application-main" className="s9-apply-main"><span className="s9-kicker">MALMOIM · SEASON 09</span><h1>{en?'Apply for Season 9':'말모임 9기 참가 신청'}</h1><p>{en?'Fill in your details, then check everything before submitting.':'정보를 입력한 뒤 마지막에 한 번 더 확인해주세요.'}</p><InstantApplication locale={locale}/></main></div>;
}
