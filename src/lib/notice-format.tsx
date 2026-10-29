import {Fragment} from 'react';
// Small, escaped text format: toolbar emphasis and three heading sizes only.
// No raw HTML, scripts, embeds or arbitrary CSS are interpreted.
function inline(value:string){return value.split(/(\*\*\*[^*\n]+\*\*\*|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g).map((part,i)=>part.startsWith('***')&&part.endsWith('***')?<strong key={i}><em>{part.slice(3,-3)}</em></strong>:part.startsWith('**')&&part.endsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:part.startsWith('*')&&part.endsWith('*')?<em key={i}>{part.slice(1,-1)}</em>:<Fragment key={i}>{part}</Fragment>);}
export function NoticeBody({content}:{content:string}){return <div className="notice-formatted">{content.split('\n').map((line,i)=>{const match=/^(#{1,3}) (.*)$/.exec(line);if(match){const text=inline(match[2]);return match[1].length===1?<h2 key={i}>{text}</h2>:match[1].length===2?<h3 key={i}>{text}</h3>:<h4 key={i}>{text}</h4>;}return <p key={i}>{line?inline(line):<br/>}</p>;})}</div>;}
export function noticeExcerpt(content:string){return content.replace(/^#{1,3} /gm,'').replace(/\*\*/g,'').replace(/\*/g,'').replace(/\s+/g,' ').slice(0,140);}
export const noticeImageUrl=(path:string)=>'/api/announcements/images/'+path;
