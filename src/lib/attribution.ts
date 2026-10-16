export const trafficSources={naver:'네이버',everytime:'에브리타임',daangn:'당근',meta:'메타',instagram:'인스타그램'};
export type Attribution={utm_source:string;utm_medium:string;utm_campaign:string};
export function readAttribution(params:URLSearchParams):Attribution{
 const clean=(value:string|null)=>(value??'').trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,150);
 const raw=clean(params.get('utm_source')||params.get('source')).toLowerCase();
 const aliases:Record<string,string>={'네이버':'naver','에브리타임':'everytime','당근':'daangn',carrot:'daangn',karrot:'daangn','메타':'meta','인스타그램':'instagram'};
 return {utm_source:aliases[raw]??raw,utm_medium:clean(params.get('utm_medium')),utm_campaign:clean(params.get('utm_campaign'))};
}
export function taggedRecruitmentUrl(url:string,source:string,medium:string,campaign:string){
 const parsed=new URL(url);if(parsed.protocol!=='https:')throw new Error('invalid_url');
 const values=readAttribution(new URLSearchParams({utm_source:source,utm_medium:medium,utm_campaign:campaign}));
 for(const [key,value]of Object.entries(values)){if(value)parsed.searchParams.set(key,value);else parsed.searchParams.delete(key);}
 parsed.searchParams.delete('source');return parsed.toString();
}
