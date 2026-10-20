"use client";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { mutateCommunity,recordCommunityView } from "@/app/actions/community-board";
import { useEffect } from "react";
import { boardText,type BoardField,type CommunityActionState } from "@/lib/community-board-model";
import type { PublicLocale } from "@/lib/public-content";
export function BoardForm({action,fields=[],hidden={},label,locale="ko",cancel,confirm}:{
 action:string;fields?:BoardField[];hidden?:Record<string,string>;label:string;locale?:PublicLocale;cancel?:string;confirm?:string;
}){
 const [state,submit,pending]=useActionState(mutateCommunity,{message:""} as CommunityActionState);
 const [values,setValues]=useState<Record<string,string>>(()=>Object.fromEntries(fields.map(f=>[f.name,f.value??""])));
 const [submitted,setSubmitted]=useState("");
 const [feedbackHidden,setFeedbackHidden]=useState(false);
 const nonce=useRef(""),response=useRef<CommunityActionState|null>(null);
 const t=(ko:string,en:string)=>boardText(locale,ko,en);
 const unchanged=JSON.stringify(values)===submitted;
 return <form className="community-form" action={submit} aria-busy={pending} onSubmit={event=>{
  if(pending||(state.success&&unchanged)){event.preventDefault();return;}
  if(confirm&&!window.confirm(confirm)){event.preventDefault();return;}
  setFeedbackHidden(false);
  if(!nonce.current||(state.success&&response.current!==state)){nonce.current=crypto.randomUUID();response.current=state;}
  const input=event.currentTarget.elements.namedItem("nonce") as HTMLInputElement;input.value=nonce.current;setSubmitted(JSON.stringify(values));
 }}>
  <input type="hidden" name="action" value={action}/><input type="hidden" name="locale" value={locale}/><input type="hidden" name="nonce"/>
  {Object.entries(hidden).map(([key,value])=><input type="hidden" key={key} name={key} value={value}/>)}
  <fieldset disabled={pending}>
   {fields.map(field=><label key={field.name}>{field.label}{field.required?" *":""}
    {field.type==="select"?<select name={field.name} required={field.required} value={values[field.name]} onChange={e=>{setValues(current=>({...current,[field.name]:e.target.value}));setFeedbackHidden(true);}}>{field.options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:
    field.type==="textarea"?<textarea name={field.name} rows={field.name==="content"&&action==="post_save"?12:3} required={field.required} maxLength={field.maxLength} value={values[field.name]} onChange={e=>{setValues(current=>({...current,[field.name]:e.target.value}));setFeedbackHidden(true);}}/>:
    <input name={field.name} required={field.required} maxLength={field.maxLength} value={values[field.name]} onChange={e=>{setValues(current=>({...current,[field.name]:e.target.value}));setFeedbackHidden(true);}}/>}
   </label>)}
   <div className="community-form-actions"><button type="submit" disabled={pending||!!(state.success&&unchanged)}>{pending?t("처리 중…","Saving…"):label}</button>
    {cancel&&<Link href={cancel} onClick={event=>{if(fields.some(f=>values[f.name]!== (f.value??""))&&!window.confirm(t("변경 내용을 버릴까요?","Discard your changes?"))){event.preventDefault();return;}setValues(Object.fromEntries(fields.map(f=>[f.name,f.value??""])));setFeedbackHidden(true);event.currentTarget.closest("details")?.removeAttribute("open");}}>{t("취소","Cancel")}</Link>}
   </div>
  </fieldset>
  {state.message&&!feedbackHidden&&<p role={state.success?"status":"alert"}>{state.message}</p>}
 </form>;
}
export function CommunityViewCounter({id}:{id:string}){
 useEffect(()=>{void recordCommunityView(id);},[id]);
 return null;
}
