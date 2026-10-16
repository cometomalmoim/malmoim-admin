import { personFields, type PersonInput } from './people-types.ts';
import { validUuid } from './resource-validation.ts';
export function peopleInput(form: FormData) {
  const input = {} as PersonInput;
  for (const [key, label, limit] of personFields) {
    const value = String(form.get(key) ?? '').trim();
    if (value.length > limit) throw new Error(`${label}: ${limit}자 이내로 입력해주세요.`);
    input[key] = value;
  }
  if (!input.name) throw new Error('이름을 입력해주세요.');
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error('이메일 형식을 확인해주세요.');
  for (const key of ['photo_url', 'instagram'] as const) {
    if (!input[key]) continue;
    let url: URL; try { url = new URL(input[key]); } catch { throw new Error('올바른 HTTPS URL을 입력해주세요.'); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('HTTPS URL만 사용할 수 있습니다.');
    if (key === 'instagram' && !['instagram.com', 'www.instagram.com'].includes(url.hostname)) throw new Error('Instagram 주소를 입력해주세요.');
    input[key] = url.href;
  }
  const links = (key: string) => {
    const ids = [...new Set(form.getAll(key).map(String))];
    if (ids.length > 200 || ids.some(id => !validUuid(id))) throw new Error('연결 항목을 확인해주세요.');
    return ids;
  };
  return { ...input, event_ids: links('event_ids'), resource_ids: links('resource_ids') };
}
