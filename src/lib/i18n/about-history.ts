import {aboutHistoryEnglish} from './about-history-en';
export function englishPublicText(value:string):string {
 const key=value.trim().replace(/\s+/g,' '), exact=aboutHistoryEnglish[key];
 if(exact)return value.replace(value.trim(),exact);
 const rules:[RegExp,(...parts:string[])=>string][]=[
  [/^게시물 (\d+)개 중 (\d+)개 표시$/,(total,shown)=>`Showing ${shown} of ${total} posts`],
  [/^\|\s*(\d+)분$/,n=>`| ${n} min`],
  [/^(\d+)년 공개된 사진이 아직 없습니다[.]$/,n=>`No published photos from ${n} yet.`],
  [/^(\d+)기$/,n=>`Season ${n}`],
  [/^(\d+)기 정규 세션 사진이 아직 없습니다[.]$/,n=>`No regular session photos for Season ${n} yet.`],
  [/^(\d+)년 특별 활동 사진이 아직 없습니다[.]$/,n=>`No special event photos from ${n} yet.`],
  [/^(.+) (기수|연도) 필터$/,(label,kind)=>`Filter ${englishPublicText(label)} by ${kind==='기수'?'season':'year'}`],
  [/^(.+) 특징$/,label=>`${englishPublicText(label)} features`],
  [/^정규 세션 · (\d+)기$/,n=>`Regular sessions · Season ${n}`],
  [/^(.+) 사진 상세 보기$/,title=>`View photos: ${title}`],
  [/^(.+) 후기 상세 보기$/,title=>`Read story: ${title}`],
  [/^(.+) 첨부 사진 (\d+)$/,(title,n)=>`${title}, attached photo ${n}`],
  [/^기존 첨부 사진 (\d+)$/,n=>`Existing attachment ${n}`],
  [/^기존 사진 (\d+) (유지|삭제)$/,(n,action)=>`${action==='유지'?'Keep':'Remove'} existing photo ${n}`],
  [/^(\d+)번 사진 보기$/,n=>`View photo ${n}`],
  [/^첨부 예정: (.+)$/,name=>`Ready to attach: ${name}`],
  [/^(.+) 첨부 취소$/,name=>`Remove attachment: ${name}`],
  [/^(.+) 대표 사진$/,title=>`Cover photo for ${title}`],
  [/^(.+) (\d+)번 사진$/,(title,n)=>`${title}, photo ${n}`],
  [/^사진\s*(\d+)\s*\/\s*(\d+)$/,(n,total)=>`Photo ${n} / ${total}`],
  [/^사진\s*(\d+)개 중\s*(\d+)개 표시$/,(total,n)=>`Showing ${n} of ${total} photos`],
  [/^후기\s*(\d+)개 표시$/,n=>`Showing ${n} stories`],
  [/^기존 사진\s*(\d+)(.*)$/,(n,suffix)=>`Existing photo ${n}${englishPublicText(suffix)}`],
 ];
 for(const [pattern,render] of rules){const m=key.match(pattern);if(m)return render(...m.slice(1));}
 return value;
}
