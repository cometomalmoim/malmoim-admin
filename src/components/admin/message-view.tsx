import {EventSmsManager} from './event-sms-manager';
import {AdminShell} from './admin-shell';
import {MessagingComposer} from './messaging-composer';
import {getMessageEvents} from '@/lib/message-events';
export async function MessageView({email}:{email:string}){
 const result=await getMessageEvents();
 return <AdminShell email={email} current="messages" title="메시징">{result.kind==='ready'?<><EventSmsManager events={result.events}/><MessagingComposer events={result.events}/></>:<section className="ops-panel" role="alert"><h1>메시징</h1><h2>이벤트 목록을 불러오지 못했습니다</h2><p>새로고침해 다시 시도해주세요.</p></section>}</AdminShell>;
}
