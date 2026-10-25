import {SmsSettings} from './sms-controls';
import {EventSmsLogs} from './event-sms-logs';
import './messaging-layout.css';
import {EventSmsManager} from './event-sms-manager';
import {AdminShell} from './admin-shell';
import {MessagingComposer} from './messaging-composer';
import {getMessageEvents} from '@/lib/message-events';
export async function MessageView({email}:{email:string}){
 const result=await getMessageEvents();
 return <AdminShell email={email} current="messages" title="메시징">{result.kind==='ready'?<><MessagingComposer events={result.events}/><details id="messaging-logs" className="ops-panel messaging-log-section"><summary>문자 발송 기록 확인</summary><EventSmsLogs events={result.events}/></details><details className="ops-panel messaging-settings-section"><summary>문자 연결·신청 알림 설정</summary><p className="ops-muted">발신번호·연결 상태와 자동 신청 알림을 관리합니다.</p><SmsSettings showLogs={false}/></details><div id="messaging-templates"><EventSmsManager events={result.events} showLogs={false}/></div></>:<section className="ops-panel" role="alert"><h1>메시징</h1><h2>이벤트 목록을 불러오지 못했습니다</h2><p>새로고침해 다시 시도해주세요.</p></section>}</AdminShell>;
}
