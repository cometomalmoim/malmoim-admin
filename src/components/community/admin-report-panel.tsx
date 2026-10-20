"use client";
import {useEffect,useRef} from "react";
import {useRouter} from "next/navigation";

export function AdminReportPanel({children,closeHref}:{children:React.ReactNode;closeHref:string}){
 const root=useRef<HTMLElement>(null),router=useRouter();
 useEffect(()=>{
  const panel=root.current;if(!panel)return;
  const previous=document.activeElement as HTMLElement|null;
  const before=document.body.style.overflow;
  const media=window.matchMedia("(max-width: 700px)");
  function update(){
   document.body.style.overflow=media.matches?"hidden":before;
   if(media.matches){panel!.setAttribute("role","dialog");panel!.setAttribute("aria-modal","true");}
   else {panel!.removeAttribute("role");panel!.removeAttribute("aria-modal");}
  }
  update();panel.focus();media.addEventListener("change",update);
  return ()=>{media.removeEventListener("change",update);document.body.style.overflow=before;if(previous?.isConnected)previous.focus();};
 },[]);
 return <aside ref={root} className="member-panel member-report-detail" aria-labelledby="member-report-detail-title" tabIndex={-1} onKeyDown={event=>{
  if(event.key==="Escape"){event.preventDefault();router.push(closeHref,{scroll:false});return;}
  if(event.key!=="Tab"||!window.matchMedia("(max-width: 700px)").matches)return;
  const items=[...event.currentTarget.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not([type="hidden"]):not(:disabled),textarea:not(:disabled),select:not(:disabled),summary')].filter(el=>el.getClientRects().length);
  const first=items[0],last=items.at(-1);
  if(event.shiftKey&&(document.activeElement===first||document.activeElement===root.current)){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
 }}>{children}</aside>;
}
