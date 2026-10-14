export const PDF_LIMIT = 3 * 1024 * 1024;
export const RESOURCE_KINDS = { english: '영어 교육자료', korean: '한국어 교육자료', common: '공통 운영자료' };
export function validUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
export function safeLink(value: string) { try { const u=new URL(value); return ['http:','https:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; } }
export function validatePdf(name: string, type: string, bytes: Uint8Array): string | null {
 if (!/\.pdf$/i.test(name) || type !== 'application/pdf') return 'PDF 파일만 등록할 수 있습니다.';
 if (!bytes.length || bytes.length > PDF_LIMIT) return '파일당 최대 3MB까지 등록할 수 있습니다.';
 const text = new TextDecoder('latin1').decode(bytes);
 if (!/^%PDF-1\.[0-9]/.test(text) && !/^%PDF-2\.0/.test(text)) return 'PDF 파일 형식이 올바르지 않습니다.';
 if (!text.slice(-2048).includes('%%EOF')) return '완전한 PDF 파일을 선택해주세요.';
 // 보수적 검사. 백신이나 전체 PDF 구조 분석을 대체하지 않습니다.
 if (/\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia|OpenAction|AA|ObjStm|Encrypt|SubmitForm|ImportData|GoToR)\b/i.test(text) || /#[0-9a-f]{2}/i.test(text)) return '스크립트·실행 동작·첨부 콘텐츠가 있는 PDF는 등록할 수 없습니다.';
 return null;
}
export function resourceInput(data: FormData) {
 const text=(key:string,max:number)=>String(data.get(key)??'').trim().slice(0,max);
 const number=(key:string)=>{ const value=text(key,20); if(!value)return null; const n=Number(value); if(!Number.isSafeInteger(n)||n<1||n>100000)throw new Error('기수·회차·누적 주차는 1~100000 사이 정수로 입력해주세요.'); return n; };
 const title=text('title',151),kind=text('kind',20),event_id=text('event_id',50)||null,external_url=text('external_url',2001);
 if(!title||title.length>150||!Object.hasOwn(RESOURCE_KINDS,kind))throw new Error('제목과 자료 종류를 확인해주세요.');
 if(event_id&&!validUuid(event_id))throw new Error('연결 이벤트를 확인해주세요.');
 if(external_url&&(external_url.length>2000||!safeLink(external_url)))throw new Error('외부 링크는 올바른 http/https 주소로 입력해주세요.');
 const topic=text('topic',201),description=text('description',5001);
 if(topic.length>200||description.length>5000)throw new Error('주제는 200자, 설명은 5000자 이내로 입력해주세요.');
 return {title,kind,event_id,external_url,topic,description,season:number('season'),session_number:number('session_number'),cumulative_week:number('cumulative_week')};
}
