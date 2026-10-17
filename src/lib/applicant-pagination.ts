export function applicantPages(current:number,total:number):(number|null)[]{
 if(!Number.isSafeInteger(total)||total<1)return [];
 const page=Math.max(1,Math.min(total,Number.isSafeInteger(current)?current:1));
 const pages=new Set([1,total]);
 if(total<=7)for(let n=1;n<=total;n++)pages.add(n);
 else for(let n=Math.max(2,page-2);n<=Math.min(total-1,page+2);n++)pages.add(n);
 const result:(number|null)[]=[];let previous=0;
 for(const n of [...pages].sort((a,b)=>a-b)){if(previous&&n>previous+1)result.push(null);result.push(n);previous=n;}
 return result;
}
