export type EventInput = {
  title: string; description: string; image_url: string; starts_at: string; ends_at: string;
  location: string; capacity: number | null; fee_notice: string; opens_at: string | null; closes_at: string | null;
  fee_amount_krw: number | null; payment_method: string; payment_bank_name: string;
  payment_account_number: string; payment_account_holder: string; payment_due_at: string | null; payment_notice: string;
  visual_theme: 'default' | 'halloween';
};
export function eventInput(data: FormData): EventInput {
  function text(key: string, label: string, max: number, required = false) {
    const value = String(data.get(key) ?? '').trim();
    if ((required && !value) || value.length > max) throw new Error(`${label} 항목을 확인해주세요. (최대 ${max}자)`);
    return value;
  }
  function date(key: string, label: string) {
    const value = text(key, label, 16, true);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error(`${label} 항목을 확인해주세요.`);
    const parsed = new Date(`${value}:00+09:00`);
    if (!Number.isFinite(parsed.getTime()) || new Date(parsed.getTime() + 9 * 3600000).toISOString().slice(0, 16) !== value) throw new Error(`${label} 항목을 확인해주세요.`);
    return parsed.toISOString();
  }
  const image_url = text('image_url', '이미지 주소', 2000);
  if (image_url) {
    let url: URL;
    try { url = new URL(image_url); } catch { throw new Error('이미지는 https 주소를 입력해주세요.'); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('이미지는 인증정보 없는 https 주소를 입력해주세요.');
  }
  const capacityText = text('capacity', '정원', 6);
  const capacity = capacityText ? Number(capacityText) : null;
  if (capacity !== null && (!/^\d+$/.test(capacityText) || !Number.isSafeInteger(capacity) || capacity < 1 || capacity > 100000)) throw new Error('정원은 1~100000명으로 입력해주세요.');
  const feeText=text('fee_amount_krw','참가비',12);
  const fee_amount_krw=feeText===''?null:Number(feeText);
  if(fee_amount_krw!==null&&(!/^\d+$/.test(feeText)||!Number.isSafeInteger(fee_amount_krw)||fee_amount_krw<0||fee_amount_krw>2147483647))throw new Error('참가비는 미정으로 비우거나 0~2,147,483,647원 정수로 입력해주세요.');
  const dueText=text('payment_due_at','납부 기한',16);
  const payment_due_at=dueText?new Date(`${dueText}:00+09:00`):null;
  if(dueText&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dueText)||!Number.isFinite(payment_due_at!.getTime())||new Date(payment_due_at!.getTime()+9*3600000).toISOString().slice(0,16)!==dueText))throw new Error('납부 기한을 확인해주세요.');
  const result = {
    title: text('title', '제목', 150, true), description: text('description', '소개', 5000), image_url,
    starts_at: date('starts_at', '행사 시작'), ends_at: date('ends_at', '행사 종료'),
    location: text('location', '장소', 300, true), capacity, fee_notice: text('fee_notice', '참가비 안내', 1000),
    fee_amount_krw,payment_method:text('payment_method','입금 방식',80),payment_bank_name:text('payment_bank_name','은행',100),payment_account_number:text('payment_account_number','계좌번호',100),payment_account_holder:text('payment_account_holder','예금주',100),payment_due_at:payment_due_at?.toISOString()??null,payment_notice:text('payment_notice','입금 안내 문구',2000),
    opens_at: text('opens_at', '모집 시작', 16) ? date('opens_at', '모집 시작') : null,
    closes_at: text('closes_at', '모집 마감', 16) ? date('closes_at', '모집 마감') : null,
    visual_theme: text('visual_theme', '화면 스타일', 20) || 'default',
  };
  if (!['default', 'halloween'].includes(result.visual_theme)) throw new Error('화면 스타일을 확인해주세요.');
  if (result.ends_at <= result.starts_at) throw new Error('행사 종료는 시작 이후여야 합니다.');
  if (Boolean(result.opens_at) !== Boolean(result.closes_at)) throw new Error('모집 시작과 마감을 함께 입력하거나 모두 비워주세요.');
  if (result.opens_at && result.closes_at && result.closes_at <= result.opens_at) throw new Error('모집 마감은 모집 시작 이후여야 합니다.');
  if (result.closes_at && result.closes_at > result.starts_at) throw new Error('모집 마감은 행사 시작 이전 또는 같은 시각으로 설정해주세요.');
  return {...result, visual_theme: result.visual_theme as EventInput['visual_theme']};
}
export function eventLocalDate(value?: string | null) {
  return value ? new Date(new Date(value).getTime() + 9 * 3600000).toISOString().slice(0, 16) : '';
}
