import { PDFDocument } from 'pdf-lib';
// Only the server upload route imports this parser; never send file content to logs.
export async function pdfStructure(bytes:Uint8Array):Promise<string|null>{
 try{
 const document=await PDFDocument.load(bytes,{ignoreEncryption:false,throwOnInvalidObject:true,updateMetadata:false});
 if(document.getPageCount()<1||document.getPageCount()>1000)return 'PDF는 1~1000페이지까지 등록할 수 있습니다.';
 // Reject executable/embedded actions even when names use unusual encodings.
 for(const [,object] of document.context.enumerateIndirectObjects()){
  if(/\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia|OpenAction|AA|SubmitForm|ImportData|GoToR)\b/i.test(object.toString()))return '실행 동작·첨부 콘텐츠가 있는 PDF는 등록할 수 없습니다.';
 }
 return null;
 }catch{return '손상되었거나 암호화된 PDF는 등록할 수 없습니다.';}
}
