export function season9LanguageHref(english:boolean,search='',hash=''){
 const params=new URLSearchParams(search),query=new URLSearchParams();
 for(const key of ['utm_source','utm_medium','utm_campaign','utm_term','utm_content']){const value=params.get(key);if(value)query.set(key,value.slice(0,150));}
 return (english?'/season9':'/season9/en')+(query.size?'?'+query.toString():'')+hash;
}
