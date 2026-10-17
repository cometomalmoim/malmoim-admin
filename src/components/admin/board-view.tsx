import { AdminShell } from './admin-shell';
import { BoardWorkspace } from './board-workspace';
import { getBoard } from '@/lib/board';
export async function BoardView({ email }: { email: string }) {
  const data = await getBoard();
  return <AdminShell current="internal-board" title="내부 게시판" email={email}><div className="ops-heading"><h1>내부 게시판</h1><p>운영진의 공지와 이야기를 나누세요.</p></div>{data ? <BoardWorkspace initial={data}/> : <section className="ops-panel" role="alert"><h2>게시판을 불러오지 못했습니다</h2><p>게시판 DB 마이그레이션과 관리자 권한을 확인한 뒤 새로고침해주세요.</p></section>}</AdminShell>;
}
