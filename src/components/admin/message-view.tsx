import {AdminShell} from './admin-shell';import {MessagePreview} from './message-preview';
export function MessageView({email}:{email:string}){return <AdminShell email={email} current="messages" title="문자 발송 준비"><div className="ops-heading"><h1>문자 발송 준비</h1><p>입금 안내 대상·제외 사유와 개인별 내용을 가상 데이터로 확인합니다.</p></div><MessagePreview/></AdminShell>;}
