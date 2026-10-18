import { AdminShell } from './admin-shell';
import { PeopleWorkspace } from './people-workspace';
import { getPeople } from '@/lib/people';
export async function PeopleView({ email = '' }: { email?: string }) {
  const data = await getPeople();
  return <AdminShell current="people" title="피플 (프로필) 관리" email={email}><div className="ops-heading"><h1>피플 <small>프로필 관리</small></h1><p>말모임을 함께 만드는 운영진과 담당 업무를 관리합니다.</p></div>{data ? <PeopleWorkspace data={data} /> : <section className="ops-panel" role="alert"><h2>프로필을 불러오지 못했습니다</h2><p>Supabase people 테이블과 관리자 권한을 확인한 뒤 새로고침해주세요.</p></section>}</AdminShell>;
}
