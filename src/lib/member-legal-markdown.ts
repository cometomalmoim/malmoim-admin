import type {LegalBlock,MemberLegalDocument} from "./member-legal";

// Deliberately limited to the supplied document syntax. No HTML execution,
// remote imports, or silently dropped unsupported Markdown.
export function parseLegalMarkdown(source:string){
 const lines=source.replace(/\r\n/g,"\n").trimEnd().split("\n");
 if(!lines[0]?.startsWith("# "))throw new Error("Document title required");
 const title=lines[0].slice(2),introduction:LegalBlock[]=[];
 const sections:{id:string;title:string;blocks:LegalBlock[]}[]=[];
 let current=introduction;
 const tableCells=(line:string)=>line.trim().slice(1,-1).split("|").map(cell=>cell.trim());
 for(let i=1;i<lines.length;){
  const line=lines[i];
  if(!line.trim()){i++;continue;}
  if(line.startsWith("## ")){
   const number=/^(?:제(\d+)조|Article (\d+))/.exec(line.slice(3));
   if(!number)throw new Error("Numbered article required");
   const section={id:"article-"+(number[1]??number[2]),title:line.slice(3),blocks:[] as LegalBlock[]};
   if(sections.some(s=>s.id===section.id))throw new Error("Duplicate article");
   sections.push(section);current=section.blocks;i++;continue;
  }
  if(line.startsWith("### ")){current.push({type:"subheading",text:line.slice(4)});i++;continue;}
  if(line.startsWith("|")){
   const headers=tableCells(line);
   if(!lines[i+1]||!tableCells(lines[i+1]).every(cell=>/^:?-+:?$/.test(cell)))throw new Error("Invalid table separator");
   i+=2;const rows:string[][]=[];
   while(i<lines.length&&lines[i].startsWith("|")){const row=tableCells(lines[i++]);if(row.length!==headers.length)throw new Error("Table column mismatch");rows.push(row);}
   current.push({type:"table",headers,rows});continue;
  }
  const item=/^(?:(\d+)\. |(-) )(.*)$/.exec(line);
  if(item){
   const ordered=!!item[1],items:{text:string;number?:number}[]=[];
   while(i<lines.length){const next=/^(?:(\d+)\. |(-) )(.*)$/.exec(lines[i]);if(!next||!!next[1]!==ordered)break;items.push({text:next[3],...(ordered?{number:Number(next[1])}:{})});i++;}
   current.push({type:"list",ordered,items});continue;
  }
  if(/^#|^```|^>/.test(line))throw new Error("Unsupported document syntax");
  const paragraph=[line];i++;
  while(i<lines.length&&lines[i].trim()&&!/^(#|\||\d+\. |\- )/.test(lines[i]))paragraph.push(lines[i++]);
  current.push({type:"paragraph",text:paragraph.join("\n")});
 }
 return {title,introduction,sections};
}

// Explicit preparation helper, not a publication or signup switch. No default
// version/date: those must be supplied in a separately reviewed publication.
export function prepareMemberLegalDocument(ko:string,en:string,version:string,effectiveDate:string|null):MemberLegalDocument{
 const korean=parseLegalMarkdown(ko),english=parseLegalMarkdown(en);
 if(!version)throw new Error("Document version required");
 if(korean.sections.length!==english.sections.length)throw new Error("Translation article mismatch");
 const shape=(blocks:LegalBlock[])=>blocks.map(block=>block.type==="list"?[block.type,block.ordered,block.items.map(item=>item.number??null)]:block.type==="table"?[block.type,block.headers.length,block.rows.map(row=>row.length)]:[block.type]);
 if(JSON.stringify(shape(korean.introduction))!==JSON.stringify(shape(english.introduction)))throw new Error("Translation introduction mismatch");
 return {version,effectiveDate,title:{ko:korean.title,en:english.title},introduction:{ko:korean.introduction,en:english.introduction},sections:korean.sections.map((section,index)=>{
  const translated=english.sections[index];
  if(section.id!==translated.id||JSON.stringify(shape(section.blocks))!==JSON.stringify(shape(translated.blocks)))throw new Error("Translation block mismatch: "+section.id);
  return {id:section.id,title:{ko:section.title,en:translated.title},paragraphs:{ko:[],en:[]},blocks:{ko:section.blocks,en:translated.blocks}};
 })};
}
