"use client";
import {useActionState,useRef,useState} from "react";
import {mutateCommunity} from "@/app/actions/community-board";
import type {CommunityActionState} from "@/lib/community-board-model";
import type {ModerationOption} from "@/lib/member-board-admin-model";

export function AdminModerationForm({options}:{options:ModerationOption[]}){
 const [choice,setChoice]=useState(options[0]?.value??"");
 const [reason,setReason]=useState("");
 const [feedbackHidden,setFeedbackHidden]=useState(false);
 const gate=useRef(false);
 const [submitted,setSubmitted]=useState("");
 const option=options.find(o=>o.value===choice)??options[0];
 const signature=JSON.stringify([option,reason]);
 const [state,submit,pending]=useActionState(async(previous:CommunityActionState,form:FormData)=>{
  try{return await mutateCommunity(previous,form);}catch{return {message:"요청을 처리하지 못했습니다. 입력한 사유는 유지됩니다."};}finally{gate.current=false;}
 },{message:""} as CommunityActionState);
 if(!option)return <p>현재 실행할 수 있는 조치가 없습니다.</p>;
 const prefix=option.prefix??"";
 return <form className="member-moderation-form" action={submit} aria-busy={pending} onSubmit={event=>{
  if(gate.current||pending||(state.success&&submitted===signature)){event.preventDefault();return;}
  if(!reason.trim()){event.preventDefault();event.currentTarget.querySelector("textarea")?.focus();return;}
  if(!window.confirm(`${option.label}\n이 조치를 실행할까요?`)){event.preventDefault();return;}
  gate.current=true;setSubmitted(signature);setFeedbackHidden(false);
 }}>
  <input type="hidden" name="admin" value="true"/><input type="hidden" name="action" value={option.action}/><input type="hidden" name="id" value={option.id}/><input type="hidden" name="version" value={option.version}/>
  <input type="hidden" name="status" value={option.status??""}/><input type="hidden" name="is_pinned" value={option.is_pinned??""}/><input type="hidden" name="reason" value={prefix+reason}/>
  <fieldset disabled={pending}><label>실행할 조치<select value={option.value} onChange={e=>{setChoice(e.target.value);setFeedbackHidden(true);}}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
   <label>처리 사유<textarea value={reason} onChange={e=>{setReason(e.target.value);setFeedbackHidden(true);}} required maxLength={500-prefix.length} rows={3} placeholder="조치 근거를 입력하세요. 운영 기록에 저장됩니다."/></label><small>{reason.length} / {500-prefix.length}</small>
   <button className="member-primary" disabled={pending||(!!state.success&&submitted===signature)}>{pending?"저장 중…":"선택한 조치 실행"}</button>
  </fieldset>
  {state.message&&!feedbackHidden&&<p role={state.success?"status":"alert"}>{state.message}{state.success?" 최신 상태를 반영했습니다.":""}</p>}
 </form>;
}
