export type Placement = { x: number; y: number; size: number; align: 'left' | 'center' | 'right' };
export type Candidate = { event_id: string; source: string; application_id: string; name: string; attendance: string; confirmation: string };
export type Template = { id: string; title: string; path: string; mime: string; placement: Placement };
export const defaultPlacement: Placement = { x: 50, y: 48, size: 30, align: 'center' };
export const identity = (p: Pick<Candidate, 'event_id' | 'source' | 'application_id'>) => `${p.event_id}:${p.source}:${p.application_id}`;
export function placement(value: unknown): Placement {
 const p = value as Placement;
 if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100 || !Number.isFinite(p.size) || p.size < 8 || p.size > 96 || !['left', 'center', 'right'].includes(p.align)) throw new Error('이름 위치·크기·정렬을 확인해주세요.');
 return { x: p.x, y: p.y, size: p.size, align: p.align };
}
export function selectCandidates(all: Candidate[], keys: string[]): Candidate[] {
 if (!Array.isArray(keys) || !keys.length || keys.length > 100 || new Set(keys).size !== keys.length) throw new Error('한 번에 1~100명을 중복 없이 선택해주세요.');
 return keys.map(key => { const row = all.find(p => identity(p) === key); if (!row) throw new Error('신청자 또는 이벤트가 변경되었습니다. 다시 조회해주세요.'); return row; });
}
export function requireAttended(rows: Candidate[]): Candidate[] {
 if (rows.some(row => row.attendance !== 'attended')) throw new Error('출석 완료된 신청자만 발급할 수 있습니다. 목록을 다시 확인해주세요.');
 return rows;
}
export function eligibleSelection(rows: Candidate[], keys: string[]): string[] {
 const eligible = new Set(rows.filter(row => row.attendance === 'attended').map(identity));
 return keys.filter(key => eligible.has(key));
}
export function attendedFirst(rows: Candidate[]) { return [...rows].sort((a, b) => Number(b.attendance === 'attended') - Number(a.attendance === 'attended') || a.name.localeCompare(b.name, 'ko')); }
export async function collectPages<T>(read: (from: number, to: number) => Promise<T[]>, size = 500): Promise<T[]> {
 const result: T[] = [];
 for (let from = 0; ; from += size) { const rows = await read(from, from + size - 1); result.push(...rows); if (rows.length < size) return result; }
}
export const demoCandidates: Candidate[] = Array.from({ length: 32 }, (_, i) => ({ event_id: '11111111-1111-4111-8111-111111111111', source: i % 2 ? 'manual' : 'registration', application_id: `22222222-2222-4222-8222-${String(i + 1).padStart(12, '0')}`, name: i < 2 ? '김민수' : ['홍길동', '이예원', '박하늘', 'Alex Kim'][i % 4] + (i < 6 ? '' : ` ${i + 1}`), attendance: i % 4 ? 'attended' : 'unrecorded', confirmation: i % 4 ? 'confirmed' : 'unconfirmed' }));

export function certificateSameOrigin(headers: Headers, requestUrl: string): boolean {
 try {
  const origin = new URL(headers.get('origin') ?? '');
  const protocol = headers.get('x-forwarded-proto') ?? new URL(requestUrl).protocol.slice(0, -1);
  return ['http', 'https'].includes(protocol) && origin.protocol === `${protocol}:` && origin.host === headers.get('host') && !origin.username && !origin.password && origin.pathname === '/' && !origin.search && !origin.hash;
 } catch { return false; }
}
