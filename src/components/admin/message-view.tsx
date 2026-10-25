import Link from 'next/link';
import {SmsSettings} from './sms-controls';
import {EventSmsLogs} from './event-sms-logs';
import './messaging-layout.css';
import {EventSmsManager} from './event-sms-manager';
import {AdminShell} from './admin-shell';
import {MessagingComposer} from './messaging-composer';
import {getMessageEvents} from '@/lib/message-events';
export async function MessageView({email}:{email:string}){
 const result=await getMessageEvents();
 return <AdminShell email={email} current="messages" title="메시징">{result.kind==='ready'?<>
  <div className="ops-heading"><h1>메시징</h1><p>개별 문자는 <Link href="/admin/recruitment">신청자 목록</Link>에서 보내고, 아래에서 템플릿을 관리하세요.</p></div>
  <div id="messaging-templates"><EventSmsManager events={result.events} showLogs={false}/></div>
  <details className="ops-panel messaging-settings-section"><summary>여러 명에게 보내기·번호 직접 입력</summary><MessagingComposer events={result.events}/></details>
  <details id="messaging-logs" className="ops-panel messaging-log-section"><summary>문자 발송 기록</summary><EventSmsLogs events={result.events}/></details>
  <details className="ops-panel messaging-settings-section"><summary>문자 연결·신청 알림 설정</summary><SmsSettings showLogs={false}/></details>
 </>:<section className="ops-panel" role="alert"><h1>메시징</h1><p>이벤트 목록을 불러오지 못했습니다. 새로고침해 다시 시도해주세요.</p></section>}</AdminShell>;
}
