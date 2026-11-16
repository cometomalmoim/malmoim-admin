export function season9LanguageHref(english:boolean,search='',hash='',basePath='/season9'){
 const params=new URLSearchParams(search),query=new URLSearchParams();
 for(const key of ['utm_source','utm_medium','utm_campaign','utm_term','utm_content']){const value=params.get(key);if(value)query.set(key,value.slice(0,150));}
 return (english?basePath:basePath+'/en')+(query.size?'?'+query.toString():'')+hash;
}
