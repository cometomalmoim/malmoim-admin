import {AdminShell} from './admin-shell';
import {MessagePreview,RegisteredMessagePreview} from './message-preview';
import {getMessageEvents} from '@/lib/message-events';
export async function MessageView({email}:{email:string}){
 const result=await getMessageEvents();
 return <AdminShell email={email} current="messages" title="문자 발송 준비"><div className="ops-heading"><h1>문자 발송 준비</h1><p>등록된 이벤트 정보를 확인하고 문자 발송을 준비합니다.</p></div>{result.kind==='ready'?<RegisteredMessagePreview events={result.events}/>:<section className="ops-panel" role="alert"><h2>이벤트 목록을 불러오지 못했습니다</h2><p>새로고침해 다시 시도해주세요. 조회 실패를 등록된 이벤트 없음으로 표시하지 않습니다.</p></section>}<details className="ops-panel"><summary>가상 데이터로 대상 선정·문자 미리보기 연습</summary><MessagePreview/></details></AdminShell>;
}
