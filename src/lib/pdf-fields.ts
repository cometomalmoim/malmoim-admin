// Coordinates are PDF default user-space units, before page rotation, not CSS pixels.
export type Matrix = [number, number, number, number, number, number];
export type Rect = { x: number; y: number; width: number; height: number };
export type PdfPageInfo = { pageNumber: number; viewBox: number[]; rotation: number; userUnit: number; width: number; height: number; transform: Matrix };
export type PdfFieldKind = 'signature' | 'name' | 'date';
export type PdfField = { id: string; pageNumber: number; rect: Rect; kind?: PdfFieldKind };
export const fieldLabels = { signature: '서명', name: '이름', date: '날짜' } as const;
export function fieldKind(field: PdfField): PdfFieldKind { return field.kind ?? 'signature'; }
export type PdfFieldSettings = { version: 1; fingerprint: string; pages: PdfPageInfo[]; fields: PdfField[] };
export const fieldLimits = { bytes: 5 * 1024 * 1024, pages: 50, fields: 200, json: 200000 } as const;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export function constrainRect(r: Rect): Rect {
  const width = clamp(r.width, .015, 1), height = clamp(r.height, .015, 1);
  return { x: clamp(r.x, 0, 1 - width), y: clamp(r.y, 0, 1 - height), width, height };
}
function point(m: Matrix, x: number, y: number): [number, number] { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
function bounds(points: [number, number][]): Rect {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
function corners(r: Rect): [number, number][] { return [[r.x, r.y], [r.x + r.width, r.y], [r.x, r.y + r.height], [r.x + r.width, r.y + r.height]]; }
export function toDisplay(rect: Rect, page: PdfPageInfo): Rect {
  const b = bounds(corners(rect).map(([x, y]) => point(page.transform, x, y)));
  return { x: b.x / page.width, y: b.y / page.height, width: b.width / page.width, height: b.height / page.height };
}
export function toPdf(rect: Rect, page: PdfPageInfo): Rect {
  const r = { x: rect.x * page.width, y: rect.y * page.height, width: rect.width * page.width, height: rect.height * page.height };
  return bounds(corners(r).map(([x, y]) => displayPointToPdf(x / page.width, y / page.height, page)));
}
export function displayPointToPdf(x: number, y: number, page: PdfPageInfo): [number, number] {
  const [a, b, c, d, e, f] = page.transform, det = a * d - b * c;
  if (!Number.isFinite(det) || !det) throw new Error('페이지 좌표 변환을 확인할 수 없습니다.');
  const inverse: Matrix = [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
  return point(inverse, x * page.width, y * page.height);
}
export function parseSettings(text: string, fingerprint: string, pages: PdfPageInfo[]): PdfField[] {
  if (text.length > fieldLimits.json) throw new Error('설정 데이터가 너무 큽니다.');
  const value = JSON.parse(text) as PdfFieldSettings;
  const samePage = (a: PdfPageInfo, b: PdfPageInfo) => a && ['pageNumber','rotation','userUnit','width','height'].every(key => a[key as keyof PdfPageInfo] === b[key as keyof PdfPageInfo]) && JSON.stringify(a.viewBox) === JSON.stringify(b.viewBox) && JSON.stringify(a.transform) === JSON.stringify(b.transform);
  if (!value || value.version !== 1 || value.fingerprint !== fingerprint || !Array.isArray(value.pages) || value.pages.length !== pages.length || !value.pages.every((p, i) => samePage(p, pages[i]))) throw new Error('같은 PDF와 페이지 정보의 버전 1 설정만 불러올 수 있습니다.');
  if (!Array.isArray(value.fields) || value.fields.length > fieldLimits.fields) throw new Error('서명란은 최대 200개입니다.');
  const ids = new Set<string>();
  return value.fields.map(field => {
    const page = pages.find(p => p.pageNumber === field.pageNumber);
    if (!page || typeof field.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(field.id) || ids.has(field.id)) throw new Error('서명란 식별자 또는 페이지가 올바르지 않습니다.');
    ids.add(field.id);
    if (field.kind !== undefined && !['signature', 'name', 'date'].includes(field.kind)) throw new Error('필드 종류가 올바르지 않습니다.');
    const r = field.rect;
    if (!r || ![r.x, r.y, r.width, r.height].every(Number.isFinite) || r.width <= 0 || r.height <= 0) throw new Error('서명란 좌표가 올바르지 않습니다.');
    const display = toDisplay(r, page), epsilon = .000001;
    if (display.x < -epsilon || display.y < -epsilon || display.x + display.width > 1 + epsilon || display.y + display.height > 1 + epsilon || display.width < .015 - epsilon || display.height < .015 - epsilon) throw new Error('서명란이 페이지 밖에 있거나 너무 작습니다.');
    return { id: field.id, pageNumber: field.pageNumber, rect: { x: r.x, y: r.y, width: r.width, height: r.height }, ...(field.kind === undefined ? {} : { kind: field.kind }) };
  });
}
